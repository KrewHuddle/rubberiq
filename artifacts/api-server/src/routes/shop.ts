/**
 * Shop dashboard routes (§13b) — scoped to req.principal.shopId.
 * Inventory, sales/revenue, customers/vehicles, scrap, settings, self-serve user mgmt.
 */
import { Router } from 'express';
import { z } from 'zod';
import { and, eq, gte, sql } from 'drizzle-orm';
import { getDb, schema } from '@rubberiq/db';
import { requireUser, requireUserRole, type ShopPrincipal } from '../auth.js';
import { generateSaleDoc, markSaleDocSigned } from '../services/saleDocs/generate.js';
import { renderSaleDoc } from '../services/saleDocs/render.js';
import {
  enqueueScrap,
  scheduleHaul,
  markHaulPickedUp,
  markHaulDelivered,
} from '../services/disposal/queue.js';
import { renderManifest } from '../services/disposal/manifest.js';

export const shopRouter: Router = Router();

shopRouter.use(requireUser());

function shopId(req: import('express').Request): string {
  return (req.principal as ShopPrincipal).shopId;
}

function startOfTodayUtc(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

shopRouter.get('/stats', async (req, res) => {
  const db = getDb();
  const sid = shopId(req);
  const todayStart = startOfTodayUtc();

  const [inStock] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.tires)
    .where(and(eq(schema.tires.shopId, sid), eq(schema.tires.status, 'in_stock')));

  const [intakeReview] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.tires)
    .where(and(eq(schema.tires.shopId, sid), eq(schema.tires.status, 'intake_review')));

  const [soldToday] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.tires)
    .where(
      and(
        eq(schema.tires.shopId, sid),
        eq(schema.tires.status, 'sold'),
        gte(schema.tires.soldAt, todayStart),
      ),
    );

  const [revenueToday] = await db
    .select({ cents: sql<number>`coalesce(sum(${schema.invoices.totalCents}), 0)::int` })
    .from(schema.invoices)
    .where(
      and(
        eq(schema.invoices.shopId, sid),
        eq(schema.invoices.status, 'paid'),
        gte(schema.invoices.paidAt, todayStart),
      ),
    );

  const [scrapOnHand] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.scrapTires)
    .where(and(eq(schema.scrapTires.shopId, sid), eq(schema.scrapTires.status, 'on_hand')));

  res.json({
    inStock: inStock?.n ?? 0,
    soldToday: soldToday?.n ?? 0,
    revenueTodayCents: revenueToday?.cents ?? 0,
    scrapOnHand: scrapOnHand?.n ?? 0,
    intakeReview: intakeReview?.n ?? 0,
  });
});

shopRouter.get('/tires', async (req, res) => {
  const db = getDb();
  const tires = await db.query.tires.findMany({
    where: eq(schema.tires.shopId, shopId(req)),
    orderBy: (t, { desc }) => [desc(t.createdAt)],
    limit: 200,
  });
  res.json({ tires });
});

shopRouter.get('/customers', async (req, res) => {
  const db = getDb();
  const customers = await db.query.customers.findMany({
    where: eq(schema.customers.shopId, shopId(req)),
    orderBy: (c, { desc }) => [desc(c.createdAt)],
    limit: 500,
  });
  res.json({ customers });
});

shopRouter.get('/scrap', async (req, res) => {
  const db = getDb();
  const scrap = await db.query.scrapTires.findMany({
    where: eq(schema.scrapTires.shopId, shopId(req)),
    orderBy: (s, { desc }) => [desc(s.onHandSince)],
  });
  res.json({ scrap });
});

/* ============================================================
 * Module 11 — sale-docs (liability/disclosure record per tire sale)
 * ========================================================== */

const CreateSaleDocBody = z.object({
  invoiceId: z.string().uuid(),
  tireId: z.string().uuid(),
  language: z.enum(['en', 'es']).optional(),
});

shopRouter.post('/sale-docs', async (req, res) => {
  const parse = CreateSaleDocBody.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'bad_request', issues: parse.error.issues });

  try {
    const result = await generateSaleDoc({
      shopId: shopId(req),
      invoiceId: parse.data.invoiceId,
      tireId: parse.data.tireId,
      language: parse.data.language,
    });
    return res.status(result.created ? 201 : 200).json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'internal_error';
    if (msg === 'cross_shop_forbidden') return res.status(403).json({ error: msg });
    if (msg.startsWith('tire_not_found') || msg.startsWith('invoice_not_found'))
      return res.status(404).json({ error: msg });
    throw e;
  }
});

async function loadSaleDocForShop(saleDocId: string, sid: string) {
  const db = getDb();
  const doc = await db.query.saleDocs.findFirst({
    where: eq(schema.saleDocs.id, saleDocId),
  });
  if (!doc) return null;
  const invoice = await db.query.invoices.findFirst({
    where: eq(schema.invoices.id, doc.invoiceId),
  });
  if (!invoice || invoice.shopId !== sid) return null;
  return doc;
}

shopRouter.get('/sale-docs/:id', async (req, res) => {
  const id = String(req.params.id);
  const doc = await loadSaleDocForShop(id, shopId(req));
  if (!doc) return res.status(404).json({ error: 'not_found' });
  return res.json({ saleDoc: doc });
});

shopRouter.get('/sale-docs/:id/html', async (req, res) => {
  const id = String(req.params.id);
  const doc = await loadSaleDocForShop(id, shopId(req));
  if (!doc) return res.status(404).json({ error: 'not_found' });
  const lang = req.query.lang === 'es' ? 'es' : req.query.lang === 'en' ? 'en' : undefined;
  const rendered = await renderSaleDoc({ saleDocId: doc.id, language: lang });
  res.set('content-type', 'text/html; charset=utf-8');
  return res.send(rendered.html);
});

const SignBody = z.object({
  signatureDataUrl: z
    .string()
    .startsWith('data:image/')
    .max(1_500_000),
});

shopRouter.post('/sale-docs/:id/sign', async (req, res) => {
  const id = String(req.params.id);
  const doc = await loadSaleDocForShop(id, shopId(req));
  if (!doc) return res.status(404).json({ error: 'not_found' });
  if (doc.signedAt) return res.status(409).json({ error: 'already_signed' });
  const parse = SignBody.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'bad_request', issues: parse.error.issues });
  await markSaleDocSigned(doc.id, parse.data.signatureDataUrl);
  return res.json({ ok: true, signedAt: new Date().toISOString() });
});

/* ============================================================
 * Module 12 — disposal queue (shop side)
 * ========================================================== */

const EnqueueScrapBody = z.object({
  tireId: z.string().uuid(),
  reason: z.enum(['fail_grade', 'aged_out', 'damaged', 'customer_swap']),
});

shopRouter.post('/scrap', async (req, res) => {
  const parse = EnqueueScrapBody.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'bad_request', issues: parse.error.issues });
  try {
    const result = await enqueueScrap({
      shopId: shopId(req),
      tireId: parse.data.tireId,
      reason: parse.data.reason,
    });
    return res.status(result.created ? 201 : 200).json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'internal_error';
    if (msg === 'cross_shop_forbidden') return res.status(403).json({ error: msg });
    if (msg.startsWith('tire_not_found')) return res.status(404).json({ error: msg });
    throw e;
  }
});

const ScheduleHaulBody = z.object({
  haulerId: z.string().uuid(),
  destinationFacilityId: z.string().uuid(),
  scrapIds: z.array(z.string().uuid()).min(1),
  scheduledFor: z
    .string()
    .datetime()
    .refine((s) => new Date(s).getTime() >= Date.now() - 60_000, {
      message: 'scheduledFor must not be in the past',
    })
    .optional(),
});

shopRouter.post('/hauls', requireUserRole('owner', 'manager'), async (req, res) => {
  const parse = ScheduleHaulBody.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'bad_request', issues: parse.error.issues });
  try {
    const result = await scheduleHaul({
      shopId: shopId(req),
      haulerId: parse.data.haulerId,
      destinationFacilityId: parse.data.destinationFacilityId,
      scrapIds: parse.data.scrapIds,
      scheduledFor: parse.data.scheduledFor ? new Date(parse.data.scheduledFor) : undefined,
    });
    return res.status(201).json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'internal_error';
    if (
      msg === 'no_scrap_selected' ||
      msg === 'scrap_mismatch' ||
      msg === 'scrap_not_on_hand' ||
      msg === 'hauler_not_found' ||
      msg === 'facility_not_found'
    )
      return res.status(400).json({ error: msg });
    throw e;
  }
});

shopRouter.get('/hauls', async (req, res) => {
  const db = getDb();
  const hauls = await db.query.hauls.findMany({
    where: eq(schema.hauls.shopId, shopId(req)),
    orderBy: (h, { desc }) => [desc(h.createdAt)],
    limit: 100,
  });
  res.json({ hauls });
});

shopRouter.post('/hauls/:id/pickup', requireUserRole('owner', 'manager'), async (req, res) => {
  const id = String(req.params.id);
  try {
    await markHaulPickedUp(shopId(req), id);
    return res.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'internal_error';
    if (msg === 'haul_not_found') return res.status(404).json({ error: msg });
    throw e;
  }
});

shopRouter.post('/hauls/:id/deliver', requireUserRole('owner', 'manager'), async (req, res) => {
  const id = String(req.params.id);
  try {
    await markHaulDelivered(shopId(req), id);
    return res.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'internal_error';
    if (msg === 'haul_not_found') return res.status(404).json({ error: msg });
    throw e;
  }
});

shopRouter.get('/hauls/:id/manifest', async (req, res) => {
  const haulId = String(req.params.id);
  try {
    const { html } = await renderManifest({ shopId: shopId(req), haulId });
    res.set('content-type', 'text/html; charset=utf-8');
    return res.send(html);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'internal_error';
    if (msg === 'haul_not_found' || msg === 'haul_orphaned')
      return res.status(404).json({ error: msg });
    throw e;
  }
});

// Self-serve staff management — owner only.
shopRouter.post('/users/invite', requireUserRole('owner'), (_req, res) => {
  res.status(501).json({ error: 'not_implemented', module: '13b' });
});
