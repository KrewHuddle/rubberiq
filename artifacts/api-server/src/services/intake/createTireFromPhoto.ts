/**
 * Intake pipeline: photo → vision → deterministic parse → grade → price → row.
 *
 * Liability rules baked in:
 *   - vision is a HINT; parseSize/parseDot are authoritative when they match
 *     a known pattern.
 *   - FAIL grade → tire NEVER goes to in_stock. Inserted as `rejected` and a
 *     companion `scrap_tires` row is created in the SAME transaction with
 *     reason='fail_grade'. This is the auto-route-to-scrap path.
 *   - Confidence < 0.7 → status=`intake_review` (operator confirms before stocking).
 *
 * Photos are stored inline as data URLs on `tires.intakePhotoUrl` for MVP.
 */
import { getDb, schema } from '@rubberiq/db';
import type { SupportedLang } from '@rubberiq/anthropic';
import { parseSize } from './parseSize.js';
import { parseDot } from './parseDot.js';
import { grade } from '../grading/rules.js';
import { priceFor } from '../pricing/rules.js';
import { visionParse, type Vision } from './visionParse.js';

const CONFIDENCE_THRESHOLD = 70; // < this → intake_review

export type CreateFromPhotoInput = {
  shopId: string;
  intakeUserId: string;
  photoDataUrl: string;
  language?: SupportedLang;
  /** Operator hand-entered cost (cents) if known. */
  costCents?: number;
  /** Live wholesale benchmark (cents) for this size, if catalog lookup ran. */
  benchmarkCents?: number;
  /** Shop's floor margin in bps; defaults to shop.pricingFloorMarginBps. */
  floorMarginBps?: number;
  /** Inject a clock for tests. */
  now?: Date;
  /** Inject vision for tests; otherwise calls Anthropic. */
  visionOverride?: Vision;
};

export type CreateFromPhotoResult = {
  tireId: string;
  status: 'intake_review' | 'in_stock' | 'rejected';
  grade: 'A' | 'B' | 'C' | 'D' | 'FAIL';
  priceCents: number | null;
  ageMonths: number | null;
  treadDepth32nds: number | null;
  benchmarkCents: number | null;
  vision: Vision;
  reasons: {
    lowConfidence: boolean;
    failed: boolean;
    sizeUnparsed: boolean;
    dotUnparsed: boolean;
  };
};

export async function createTireFromPhoto(
  input: CreateFromPhotoInput,
): Promise<CreateFromPhotoResult> {
  const now = input.now ?? new Date();

  // 1. Vision (HINT only)
  const vision = input.visionOverride ?? (await visionParse({
    photoDataUrl: input.photoDataUrl,
    language: input.language,
  }));

  // 2. Deterministic parsers re-validate vision output
  const sized = parseSize(vision.size);
  const dotted = parseDot(vision.dotCode, now);

  // 3. Grade (deterministic — liability backbone)
  const treadDepth32nds = vision.treadDepth32nds ?? null;
  const ageMonths = dotted?.ageMonths ?? null;
  const flags = vision.flags ?? [];
  // pre-Y2K DOT is effectively guaranteed FAIL — force it via flag.
  if (dotted?.preY2K) flags.push('aged_out_pre_y2k');
  const gradeOut = grade({ treadDepth32nds, ageMonths, flags });

  // 4. Price (FAIL → null)
  const priced = priceFor({
    grade: gradeOut.effective,
    benchmarkCents: input.benchmarkCents ?? null,
    costCents: input.costCents ?? null,
    floorMarginBps: input.floorMarginBps,
  });

  // 5. Status decision
  const lowConfidence = vision.confidence < CONFIDENCE_THRESHOLD;
  const failed = gradeOut.effective === 'FAIL';
  const status: 'intake_review' | 'in_stock' | 'rejected' = failed
    ? 'rejected'
    : lowConfidence || !sized
      ? 'intake_review'
      : 'in_stock';

  // 6. Insert tire (+ scrap row on FAIL) inside a transaction
  const db = getDb();
  const tireId = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(schema.tires)
      .values({
        shopId: input.shopId,
        intakeUserId: input.intakeUserId,
        brand: vision.brand,
        model: vision.model,
        size: sized?.raw ?? vision.size ?? 'UNKNOWN',
        dotCode: dotted?.raw ?? vision.dotCode,
        dotWeek: dotted?.week ?? null,
        dotYear: dotted?.year ?? null,
        loadIndex: vision.loadIndex,
        speedRating: vision.speedRating,
        treadDepth32nds,
        ageMonths,
        grade: gradeOut.effective,
        gradeReason: gradeOut,
        visionConfidence: Math.round(vision.confidence),
        priceCents: priced.priceCents,
        costCents: input.costCents ?? null,
        benchmarkCents: input.benchmarkCents ?? null,
        status,
        intakePhotoUrl: input.photoDataUrl,
        source: 'intake',
      })
      .returning({ id: schema.tires.id });
    if (!row) throw new Error('tire insert returned no row');

    if (failed) {
      await tx.insert(schema.scrapTires).values({
        shopId: input.shopId,
        tireId: row.id,
        reason: 'fail_grade',
        status: 'on_hand',
      });
    }

    return row.id;
  });

  return {
    tireId,
    status,
    grade: gradeOut.effective,
    priceCents: priced.priceCents,
    ageMonths,
    treadDepth32nds,
    benchmarkCents: input.benchmarkCents ?? null,
    vision,
    reasons: {
      lowConfidence,
      failed,
      sizeUnparsed: !sized,
      dotUnparsed: !dotted,
    },
  };
}
