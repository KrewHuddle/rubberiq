import { describe, it, expect } from 'vitest';
import { priceFor } from './rules.js';

describe('priceFor()', () => {
  it('FAIL returns null price', () => {
    expect(priceFor({ grade: 'FAIL', benchmarkCents: 15000 }).priceCents).toBeNull();
  });

  it('applies grade multiplier to benchmark', () => {
    expect(priceFor({ grade: 'A', benchmarkCents: 10000 }).priceCents).toBe(5500);
    expect(priceFor({ grade: 'B', benchmarkCents: 10000 }).priceCents).toBe(4500);
    expect(priceFor({ grade: 'C', benchmarkCents: 10000 }).priceCents).toBe(3500);
    expect(priceFor({ grade: 'D', benchmarkCents: 10000 }).priceCents).toBe(2500);
  });

  it('clamps to floor margin over cost', () => {
    // grade D × 10000 benchmark = 2500. cost=2500 + 20% floor = 3000 → bumped up.
    const r = priceFor({ grade: 'D', benchmarkCents: 10000, costCents: 2500 });
    expect(r.priceCents).toBe(3000);
    expect(r.hitFloor).toBe(true);
  });

  it('falls back to cost markup when no benchmark; floor clamps if needed', () => {
    const r = priceFor({ grade: 'B', costCents: 5000 });
    // 5000 × 2.0 × 0.45 = 4500; floor = 5000 × 1.20 = 6000 → bumped to 6000.
    expect(r.priceCents).toBe(6000);
    expect(r.hitFloor).toBe(true);
    expect(r.basis).toBe('cost_fallback');
  });

  it('returns null when neither benchmark nor cost', () => {
    expect(priceFor({ grade: 'A' }).priceCents).toBeNull();
  });
});
