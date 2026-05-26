/**
 * AI Tire Intake routes (§4 / Module 4) — Phase 1 implementation.
 *
 * POST /api/tires/intake/photo
 *   body: { photoDataUrl, costCents?, benchmarkCents?, language? }
 *   -> runs vision pipeline, inserts tire row, returns the reveal payload.
 *
 * POST /api/tires/intake/confirm
 *   body: { tireId, corrections?: { brand?, model?, size?, dotCode?, treadDepth32nds?, ageMonths?, priceCents?, costCents? } }
 *   -> operator confirms (or corrects) an intake_review row → in_stock.
 *      Re-grades against final tread/age — if corrections push it to FAIL,
 *      tire is rejected and a scrap row is created.
 *
 * GET /api/tires/intake/review
 *   -> list of intake_review tires for this shop.
 */
import { Router } from 'express';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { getDb, schema } from '@rubberiq/db';
import { requireUser, type ShopPrincipal } from '../auth.js';
import { createTireFromPhoto } from '../services/intake/createTireFromPhoto.js';
import { grade } from '../services/grading/rules.js';
import { priceFor } from '../services/pricing/rules.js';

export const intakeRouter: Router = Router();

intakeRouter.use(requireUser());

function principal(req: import('express').Request): ShopPrincipal {
  return req.principal as ShopPrincipal;
}

/* -------- POST /photo ---------------------------------------------------- */

const PhotoBody = z.object({
  photoDataUrl: z.string().startsWith('data:image/'),
  costCents: z.number().int().nonnegative().optional(),
  benchmarkCents: z.number().int().nonnegative().optional(),
  language: z.enum(['en', 'es']).optional(),
});

intakeRouter.post('/photo', async (req, res) => {
  const parse = PhotoBody.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: 'bad_request', issues: parse.error.issues });
  }
  const p = principal(req);

  // Data-URL guard: cap raw bytes to avoid OOM. ~5MB base64 = ~3.75MB raw.
  if (parse.data.photoDataUrl.length > 7_000_000) {
    return res.status(413).json({ error: 'photo_too_large' });
  }

  try {
    const result = await createTireFromPhoto({
      shopId: p.shopId,
      intakeUserId: p.userId,
      photoDataUrl: parse.data.photoDataUrl,
      language: parse.data.language ?? (p.language as 'en' | 'es' | undefined),
      costCents: parse.data.costCents,
      benchmarkCents: parse.data.benchmarkCents,
    });
    return res.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'intake_failed';
    return res.status(500).json({ error: 'intake_failed', message: msg });
  }
});

/* -------- POST /confirm -------------------------------------------------- */

const ConfirmBody = z.object({
  tireId: z.string().uuid(),
  corrections: z
    .object({
      brand: z.string().nullable().optional(),
      model: z.string().nullable().optional(),
      size: z.string().optional(),
      dotCode: z.string().optional(),
      treadDepth32nds: z.number().nullable().optional(),
      ageMonths: z.number().nullable().optional(),
      priceCents: z.number().int().nonnegative().optional(),
      costCents: z.number().int().nonnegative().optional(),
    })
    .optional(),
});

intakeRouter.post('/confirm', async (req, res) => {
  const parse = ConfirmBody.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: 'bad_request', issues: parse.error.issues });
  }
  const p = principal(req);
  const db = getDb();

  const tire = await db.query.tires.findFirst({
    where: and(eq(schema.tires.id, parse.data.tireId), eq(schema.tires.shopId, p.shopId)),
  });
  if (!tire) return res.status(404).json({ error: 'not_found' });
  if (tire.status === 'sold' || tire.status === 'scrapped') {
    return res.status(409).json({ error: 'invalid_state', status: tire.status });
  }

  const c = parse.data.corrections ?? {};
  const treadDepth32nds = c.treadDepth32nds ?? tire.treadDepth32nds;
  const ageMonths = c.ageMonths ?? tire.ageMonths;

  // Re-grade against the final values
  const gradeOut = grade({
    treadDepth32nds,
    ageMonths,
    flags: (tire.gradeReason?.flags as string[] | undefined) ?? [],
  });

  const failed = gradeOut.effective === 'FAIL';
  const priced = priceFor({
    grade: gradeOut.effective,
    benchmarkCents: tire.benchmarkCents,
    costCents: c.costCents ?? tire.costCents,
  });
  const priceCents = c.priceCents ?? priced.priceCents;

  const newStatus: typeof tire.status = failed ? 'rejected' : 'in_stock';

  await db.transaction(async (tx) => {
    await tx
      .update(schema.tires)
      .set({
        brand: c.brand ?? tire.brand,
        model: c.model ?? tire.model,
        size: c.size ?? tire.size,
        dotCode: c.dotCode ?? tire.dotCode,
        treadDepth32nds,
        ageMonths,
        grade: gradeOut.effective,
        gradeReason: gradeOut,
        priceCents,
        costCents: c.costCents ?? tire.costCents,
        status: newStatus,
        updatedAt: new Date(),
      })
      .where(eq(schema.tires.id, tire.id));

    if (failed) {
      // Avoid duplicate scrap rows on re-confirm.
      const existing = await tx.query.scrapTires.findFirst({
        where: eq(schema.scrapTires.tireId, tire.id),
      });
      if (!existing) {
        await tx.insert(schema.scrapTires).values({
          shopId: p.shopId,
          tireId: tire.id,
          reason: 'fail_grade',
          status: 'on_hand',
        });
      }
    }
  });

  return res.json({
    tireId: tire.id,
    status: newStatus,
    grade: gradeOut.effective,
    priceCents,
  });
});

/* -------- GET /review ---------------------------------------------------- */

intakeRouter.get('/review', async (req, res) => {
  const p = principal(req);
  const db = getDb();
  const rows = await db.query.tires.findMany({
    where: and(eq(schema.tires.shopId, p.shopId), eq(schema.tires.status, 'intake_review')),
    orderBy: (t, { desc }) => [desc(t.createdAt)],
    limit: 100,
  });
  return res.json({ tires: rows });
});
