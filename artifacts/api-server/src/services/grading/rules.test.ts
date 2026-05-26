/**
 * Grading-engine tests use a FIXTURE config — these numbers are not the
 * production bands. Real bands ship in DO secret GRADING_CONFIG_JSON.
 *
 * What we assert:
 *   - determinism (same inputs → same output)
 *   - MIN(tread, age) composition
 *   - hard-fail flags + override always FAIL
 *   - unknown tread / age conservatively grade to D
 *   - industry safety floor: tread ≤ treadHardFailMax → FAIL
 *                            age   >  ageHardFailMaxMonths → FAIL
 *   - validator rejects malformed configs
 *
 * What we do NOT assert: the specific tread/age bracket numbers — those are
 * trade-secret and live only in production env, never in source.
 */
import { afterEach, describe, it, expect, beforeEach } from 'vitest';
import {
  grade,
  isSellable,
  setGradingConfig,
  resetGradingConfig,
  type GradingConfig,
} from './rules.js';

/** Clearly fake fixture — large round numbers + dummy flag names so no reader
 *  mistakes these for production thresholds. */
const FIXTURE: GradingConfig = {
  treadBands: [
    { min: 80, grade: 'A' },
    { min: 60, grade: 'B' },
    { min: 40, grade: 'C' },
    { min: 20, grade: 'D' },
    { min: 0, grade: 'FAIL' },
  ],
  ageBands: [
    { maxMonths: 100, grade: 'A' },
    { maxMonths: 200, grade: 'B' },
    { maxMonths: 300, grade: 'C' },
    { maxMonths: 400, grade: 'D' },
    { maxMonths: Number.POSITIVE_INFINITY, grade: 'FAIL' },
  ],
  hardFailFlags: ['test_sidewall', 'test_cord'],
  treadHardFailMax: 10,
  ageHardFailMaxMonths: 400,
};

beforeEach(() => setGradingConfig(FIXTURE));
afterEach(() => resetGradingConfig());

describe('grade() · determinism + composition', () => {
  it('is deterministic — same inputs return identical reasons', () => {
    const inputs = { treadDepth32nds: 70, ageMonths: 150, flags: [] };
    const a = grade(inputs);
    const b = grade(inputs);
    expect(a).toEqual(b);
  });

  it('effective grade is MIN(tread, age) against fixture bands', () => {
    // tread=80 → A, age=300 → C → effective C
    expect(grade({ treadDepth32nds: 80, ageMonths: 300 }).effective).toBe('C');
    // tread=60 → B, age=100 → A → effective B
    expect(grade({ treadDepth32nds: 60, ageMonths: 100 }).effective).toBe('B');
  });

  it('unknown tread or age conservatively grades as D, never A', () => {
    expect(grade({}).effective).toBe('D');
    expect(grade({ treadDepth32nds: 80 }).effective).toBe('D');
    expect(grade({ ageMonths: 50 }).effective).toBe('D');
  });
});

describe('grade() · safety floors (always FAIL)', () => {
  it('tread ≤ treadHardFailMax → FAIL regardless of new age', () => {
    expect(grade({ treadDepth32nds: 10, ageMonths: 0 }).effective).toBe('FAIL');
    expect(grade({ treadDepth32nds: 5, ageMonths: 0 }).effective).toBe('FAIL');
    expect(grade({ treadDepth32nds: 0, ageMonths: 0 }).effective).toBe('FAIL');
  });

  it('age > ageHardFailMaxMonths → FAIL regardless of deep tread', () => {
    expect(grade({ treadDepth32nds: 99, ageMonths: 401 }).effective).toBe('FAIL');
    expect(grade({ treadDepth32nds: 99, ageMonths: 9999 }).effective).toBe('FAIL');
  });

  it('hard-fail flag overrides grade entirely + records flag in notes', () => {
    const r = grade({ treadDepth32nds: 80, ageMonths: 50, flags: ['test_sidewall'] });
    expect(r.effective).toBe('FAIL');
    expect(r.notes).toMatch(/test_sidewall/);
  });

  it('overrideFail forces FAIL + records operator note', () => {
    const r = grade({ treadDepth32nds: 80, ageMonths: 50, overrideFail: true });
    expect(r.effective).toBe('FAIL');
    expect(r.notes).toMatch(/operator/);
  });
});

describe('isSellable()', () => {
  it('FAIL is never sellable', () => {
    expect(isSellable('FAIL')).toBe(false);
  });
  it('A/B/C/D are sellable', () => {
    expect(isSellable('A')).toBe(true);
    expect(isSellable('B')).toBe(true);
    expect(isSellable('C')).toBe(true);
    expect(isSellable('D')).toBe(true);
  });
});

describe('setGradingConfig() · validation', () => {
  it('rejects missing treadBands', () => {
    expect(() => setGradingConfig({ ...FIXTURE, treadBands: [] })).toThrow(/non-empty/);
  });

  it('rejects malformed band grade', () => {
    const bad = {
      ...FIXTURE,
      ageBands: [{ maxMonths: 100, grade: 'X' }],
    } as unknown as GradingConfig;
    expect(() => setGradingConfig(bad)).toThrow(/A \| B \| C \| D \| FAIL/);
  });

  it('rejects non-number treadHardFailMax', () => {
    const bad = { ...FIXTURE, treadHardFailMax: '10' } as unknown as GradingConfig;
    expect(() => setGradingConfig(bad)).toThrow(/must be a finite number/);
  });
});
