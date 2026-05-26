/**
 * Deterministic pricing.
 *
 *   priceCents = round( benchmarkCents × gradeMultiplier )
 *
 * Then clamped: priceCents must be ≥ costCents × (1 + floorMarginBps/10_000).
 * If the multiplier produces a below-floor price, we bump UP to the floor.
 *
 * FAIL grade → null price (never sell).
 *
 * `benchmarkCents` is the live equivalent NEW wholesale price for the same
 * size/spec — sourced from `wholesaleCatalog` (Module 7). If absent, the
 * caller may pass a markup-based fallback derived from `costCents`.
 *
 * Constants are tunable in this file (alongside grading rules — both are part
 * of the trade-secret pricing/grading engine).
 */
import type { Grade } from '../grading/rules.js';

export type PriceInput = {
  grade: Grade;
  benchmarkCents?: number | null; // wholesale-new equivalent
  costCents?: number | null;       // what the shop paid (or 0 for trade-in)
  floorMarginBps?: number;         // override; default 2000 (20%)
};

export type Priced = {
  priceCents: number | null;
  appliedMultiplier: number | null;
  hitFloor: boolean;
  basis: 'benchmark' | 'cost_fallback' | 'none';
};

/* ---- Tunable constants (trade secret) ----------------------------------- */

const GRADE_MULTIPLIER: Record<Grade, number | null> = {
  A: 0.55,
  B: 0.45,
  C: 0.35,
  D: 0.25,
  FAIL: null,
};

/** Cost-only fallback markup when no benchmark price is available. */
const FALLBACK_MARKUP = 2.0; // 2× cost

const DEFAULT_FLOOR_MARGIN_BPS = 2000; // 20% over cost

/* ------------------------------------------------------------------------- */

export function priceFor(input: PriceInput): Priced {
  const mult = GRADE_MULTIPLIER[input.grade];
  if (mult == null) {
    return { priceCents: null, appliedMultiplier: null, hitFloor: false, basis: 'none' };
  }

  let basis: Priced['basis'] = 'benchmark';
  let basePrice: number | null = null;

  if (input.benchmarkCents != null && input.benchmarkCents > 0) {
    basePrice = Math.round(input.benchmarkCents * mult);
  } else if (input.costCents != null && input.costCents > 0) {
    basePrice = Math.round(input.costCents * FALLBACK_MARKUP * mult);
    basis = 'cost_fallback';
  } else {
    return { priceCents: null, appliedMultiplier: mult, hitFloor: false, basis: 'none' };
  }

  // Floor: ensure margin over cost.
  const floorBps = input.floorMarginBps ?? DEFAULT_FLOOR_MARGIN_BPS;
  const cost = input.costCents ?? 0;
  const floor = Math.round(cost * (1 + floorBps / 10_000));

  let hitFloor = false;
  if (basePrice < floor) {
    basePrice = floor;
    hitFloor = true;
  }

  return { priceCents: basePrice, appliedMultiplier: mult, hitFloor, basis };
}
