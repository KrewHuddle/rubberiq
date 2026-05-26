import { describe, expect, it } from 'vitest';
import {
  computeSignupCents,
  computeResidualCents,
  computeUpsellCents,
} from './commission.js';

const FLAT_PLAN = {
  signupRate: { kind: 'flat' as const, amountCents: 25_000 },
  residualRateBps: 1_000,
  residualTerm: 'life',
  upsellRateBps: 1_500,
};

const PERCENT_PLAN = {
  signupRate: { kind: 'percent' as const, bps: 5_000, ofMonths: 3 },
  residualRateBps: 500,
  residualTerm: '12',
  upsellRateBps: 1_000,
};

describe('commission · signup', () => {
  it('flat returns fixed cents regardless of subscription', () => {
    expect(computeSignupCents(FLAT_PLAN, 14_900)).toBe(25_000);
    expect(computeSignupCents(FLAT_PLAN, 0)).toBe(25_000);
  });

  it('percent applies bps to monthly × ofMonths', () => {
    // 14_900 × 3 = 44_700; × 5000 bps (50%) = 22_350
    expect(computeSignupCents(PERCENT_PLAN, 14_900)).toBe(22_350);
  });

  it('clamps negative results to zero', () => {
    expect(computeSignupCents({ signupRate: { kind: 'flat', amountCents: -500 } }, 0)).toBe(0);
  });
});

describe('commission · residual', () => {
  it('life term pays every month indefinitely', () => {
    expect(computeResidualCents(FLAT_PLAN, 14_900, 0)).toBe(1_490);
    expect(computeResidualCents(FLAT_PLAN, 14_900, 36)).toBe(1_490);
    expect(computeResidualCents(FLAT_PLAN, 14_900, 999)).toBe(1_490);
  });

  it('numeric term caps at N months', () => {
    // 14_900 × 500 bps (5%) = 745
    expect(computeResidualCents(PERCENT_PLAN, 14_900, 0)).toBe(745);
    expect(computeResidualCents(PERCENT_PLAN, 14_900, 11)).toBe(745); // last paying month
    expect(computeResidualCents(PERCENT_PLAN, 14_900, 12)).toBe(0); // term ended
    expect(computeResidualCents(PERCENT_PLAN, 14_900, 99)).toBe(0);
  });

  it('negative monthsSinceSignup returns 0', () => {
    expect(computeResidualCents(FLAT_PLAN, 14_900, -1)).toBe(0);
  });

  it('invalid term string falls back to life-like (never caps)', () => {
    const plan = { residualRateBps: 1_000, residualTerm: 'forever' };
    expect(computeResidualCents(plan, 10_000, 999)).toBe(1_000);
  });
});

describe('commission · upsell', () => {
  it('applies bps to upsell basis', () => {
    expect(computeUpsellCents(FLAT_PLAN, 10_000)).toBe(1_500);
    expect(computeUpsellCents(PERCENT_PLAN, 10_000)).toBe(1_000);
  });
  it('zero or negative basis → 0', () => {
    expect(computeUpsellCents(FLAT_PLAN, 0)).toBe(0);
    expect(computeUpsellCents(FLAT_PLAN, -500)).toBe(0);
  });
});
