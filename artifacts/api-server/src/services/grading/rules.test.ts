/**
 * Grading determinism + safety-floor tests.
 *
 * Rule of thumb:
 *   - same inputs → same grade
 *   - tread ≤ 2/32 OR age > 72mo → FAIL no matter what
 *   - hard-fail flags (sidewall_damage etc.) → FAIL no matter what
 *   - effective = MIN(treadGrade, ageGrade)
 */
import { describe, it, expect } from 'vitest';
import { grade, isSellable } from './rules.js';

describe('grade()', () => {
  it('is deterministic — same inputs return identical reasons', () => {
    const inputs = { treadDepth32nds: 6, ageMonths: 30, flags: [] };
    const a = grade(inputs);
    const b = grade(inputs);
    expect(a).toEqual(b);
  });

  it('tread ≤2/32 always FAILS regardless of new age', () => {
    expect(grade({ treadDepth32nds: 2, ageMonths: 1 }).effective).toBe('FAIL');
    expect(grade({ treadDepth32nds: 1, ageMonths: 1 }).effective).toBe('FAIL');
    expect(grade({ treadDepth32nds: 0, ageMonths: 0 }).effective).toBe('FAIL');
  });

  it('age >72mo always FAILS regardless of deep tread', () => {
    expect(grade({ treadDepth32nds: 11, ageMonths: 73 }).effective).toBe('FAIL');
    expect(grade({ treadDepth32nds: 10, ageMonths: 120 }).effective).toBe('FAIL');
  });

  it('hard-fail flags override grade entirely', () => {
    const r = grade({ treadDepth32nds: 10, ageMonths: 6, flags: ['sidewall_damage'] });
    expect(r.effective).toBe('FAIL');
    expect(r.notes).toMatch(/sidewall_damage/);
  });

  it('effective grade is MIN(tread, age)', () => {
    // tread=A (8), age=C (60mo)
    expect(grade({ treadDepth32nds: 8, ageMonths: 60 }).effective).toBe('C');
    // tread=B (6), age=A (12mo)
    expect(grade({ treadDepth32nds: 6, ageMonths: 12 }).effective).toBe('B');
  });

  it('unknown tread/age conservatively grades as D, never A', () => {
    expect(grade({}).effective).toBe('D');
    expect(grade({ treadDepth32nds: 10 }).effective).toBe('D');
    expect(grade({ ageMonths: 6 }).effective).toBe('D');
  });

  it('FAIL is never sellable', () => {
    expect(isSellable('FAIL')).toBe(false);
    expect(isSellable('A')).toBe(true);
    expect(isSellable('D')).toBe(true);
  });

  it('boundary: tread=3 is D, tread=4 is C, tread=6 is B, tread=8 is A', () => {
    expect(grade({ treadDepth32nds: 3, ageMonths: 6 }).effective).toBe('D');
    expect(grade({ treadDepth32nds: 4, ageMonths: 6 }).effective).toBe('C');
    expect(grade({ treadDepth32nds: 6, ageMonths: 6 }).effective).toBe('B');
    expect(grade({ treadDepth32nds: 8, ageMonths: 6 }).effective).toBe('A');
  });

  it('boundary: age=24 is A, 48 is B, 60 is C, 72 is D, 73 is FAIL', () => {
    expect(grade({ treadDepth32nds: 10, ageMonths: 24 }).effective).toBe('A');
    expect(grade({ treadDepth32nds: 10, ageMonths: 48 }).effective).toBe('B');
    expect(grade({ treadDepth32nds: 10, ageMonths: 60 }).effective).toBe('C');
    expect(grade({ treadDepth32nds: 10, ageMonths: 72 }).effective).toBe('D');
    expect(grade({ treadDepth32nds: 10, ageMonths: 73 }).effective).toBe('FAIL');
  });
});
