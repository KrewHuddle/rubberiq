/**
 * Commission compute (Module 14/15).
 *
 * Each commission_plan has:
 *   - signupRate: { kind:'flat', amountCents } | { kind:'percent', bps, ofMonths }
 *   - residualRateBps: bps of monthly subscription (e.g. 1000 = 10%)
 *   - residualTerm: 'life' or "12" months
 *   - upsellRateBps: bps of upsell
 *   - accelerators: optional bonus rules (treated opaque here)
 *
 * Compute functions are PURE — they take inputs + plan, return amountCents.
 * Persistence (commission_events row) happens at the call site.
 */

export type SignupRate =
  | { kind: 'flat'; amountCents: number }
  | { kind: 'percent'; bps: number; ofMonths: number };

export type CommissionPlan = {
  signupRate: SignupRate;
  residualRateBps: number;
  residualTerm: string; // 'life' | "<n>"
  upsellRateBps: number;
};

/** Signup commission earned on shop assignment.
 *  - flat: returns fixed cents
 *  - percent: bps of (monthlySubscriptionCents * ofMonths) */
export function computeSignupCents(
  plan: Pick<CommissionPlan, 'signupRate'>,
  monthlySubscriptionCents: number,
): number {
  const r = plan.signupRate;
  if (r.kind === 'flat') return Math.max(0, Math.round(r.amountCents));
  // percent: bps of (monthly * ofMonths)
  const basis = monthlySubscriptionCents * r.ofMonths;
  return Math.max(0, Math.round((basis * r.bps) / 10_000));
}

/** Residual commission for ONE month.
 *  Term:
 *    - 'life'           → always pay
 *    - integer N months → pay first N months from signedAt; cap month index N-1
 *  monthsSinceSignup is 0-indexed (month 0 = signup month). */
export function computeResidualCents(
  plan: Pick<CommissionPlan, 'residualRateBps' | 'residualTerm'>,
  monthlySubscriptionCents: number,
  monthsSinceSignup: number,
): number {
  if (monthsSinceSignup < 0) return 0;
  if (plan.residualTerm !== 'life') {
    const term = Number.parseInt(plan.residualTerm, 10);
    if (Number.isFinite(term) && term > 0 && monthsSinceSignup >= term) return 0;
  }
  return Math.max(0, Math.round((monthlySubscriptionCents * plan.residualRateBps) / 10_000));
}

/** Upsell commission on an in-account upsell amount. */
export function computeUpsellCents(
  plan: Pick<CommissionPlan, 'upsellRateBps'>,
  upsellBasisCents: number,
): number {
  if (upsellBasisCents <= 0) return 0;
  return Math.max(0, Math.round((upsellBasisCents * plan.upsellRateBps) / 10_000));
}
