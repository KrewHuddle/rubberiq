/**
 * Module 16 — health scoring (pure function).
 *
 * Inputs are deterministic 28-day-window aggregates. Output is a 0–100 score
 * plus a green/yellow/red band. Tuning constants live HERE — no env knobs yet.
 * Keep it boring and explainable: a CSM should be able to read the rubric.
 *
 * Bands (committed):
 *   ≥ 70  green   — engaged, low churn risk
 *   40-69 yellow  — watch list, surface intervention opportunities
 *   < 40  red     — at risk, prompt CSM action
 *
 * Score = sum of subscores (max 100):
 *   loginRecency   max 25   (days since most recent staff login)
 *   intakeVolume   max 25   (tires created in last 28d)
 *   salesActivity  max 25   (paid invoices in last 28d)
 *   paymentHealth  max 15   (15 if not failed, -10 if failed)
 *   supportLoad    max 10   (10 if 0 flags, 5 if 1-2, -5 if 3+)
 */

export type HealthBand = 'green' | 'yellow' | 'red';

export type HealthInputs = {
  /** Days since the most recent staff login. `null` = never logged in. */
  daysSinceLastLogin: number | null;
  /** Tire rows created in the last 28 days. */
  intakeVolume28d: number;
  /** Paid invoices in the last 28 days. */
  salesActivity28d: number;
  /** True if the most recent invoice payment attempt failed. */
  paymentFailed: boolean;
  /** Count of open support flags (placeholder — wire when support ticket schema lands). */
  supportFlags: number;
};

export type HealthResult = {
  score: number; // 0-100
  band: HealthBand;
  parts: {
    loginRecency: number;
    intakeVolume: number;
    salesActivity: number;
    paymentHealth: number;
    supportLoad: number;
  };
};

export function scoreLoginRecency(days: number | null): number {
  if (days == null) return 0;
  if (days <= 7) return 25;
  if (days <= 14) return 15;
  if (days <= 30) return 5;
  return 0;
}

export function scoreIntakeVolume(n: number): number {
  if (n >= 20) return 25;
  if (n >= 10) return 15;
  if (n >= 3) return 8;
  if (n >= 1) return 3;
  return 0;
}

export function scoreSalesActivity(n: number): number {
  if (n >= 15) return 25;
  if (n >= 8) return 15;
  if (n >= 3) return 8;
  if (n >= 1) return 3;
  return 0;
}

export function scorePaymentHealth(failed: boolean): number {
  return failed ? -10 : 15;
}

export function scoreSupportLoad(flags: number): number {
  if (flags >= 3) return -5;
  if (flags >= 1) return 5;
  return 10;
}

export function bandFor(score: number): HealthBand {
  if (score >= 70) return 'green';
  if (score >= 40) return 'yellow';
  return 'red';
}

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function computeHealth(input: HealthInputs): HealthResult {
  const parts = {
    loginRecency: scoreLoginRecency(input.daysSinceLastLogin),
    intakeVolume: scoreIntakeVolume(input.intakeVolume28d),
    salesActivity: scoreSalesActivity(input.salesActivity28d),
    paymentHealth: scorePaymentHealth(input.paymentFailed),
    supportLoad: scoreSupportLoad(input.supportFlags),
  };
  const raw =
    parts.loginRecency +
    parts.intakeVolume +
    parts.salesActivity +
    parts.paymentHealth +
    parts.supportLoad;
  const score = clamp(raw, 0, 100);
  return { score, band: bandFor(score), parts };
}
