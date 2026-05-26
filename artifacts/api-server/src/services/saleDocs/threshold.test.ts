import { describe, expect, it } from 'vitest';
import { AGE_DISCLOSURE_MONTHS } from './generate.js';

/**
 * Age-disclosure threshold is the liability backbone — sale doc flags itself
 * as `ageDisclosureRequired = true` when tire.ageMonths > AGE_DISCLOSURE_MONTHS.
 * Tests below pin the threshold to 60 months. Changing the constant is a
 * deliberate decision that should fail these tests + force a review.
 */
describe('saleDoc · age disclosure threshold', () => {
  it('threshold is 60 months (pinned)', () => {
    expect(AGE_DISCLOSURE_MONTHS).toBe(60);
  });

  function requires(ageMonths: number | null | undefined): boolean {
    return (ageMonths ?? 0) > AGE_DISCLOSURE_MONTHS;
  }

  it('below threshold → no disclosure', () => {
    expect(requires(0)).toBe(false);
    expect(requires(12)).toBe(false);
    expect(requires(59)).toBe(false);
    expect(requires(60)).toBe(false); // boundary — equal does NOT require
  });

  it('above threshold → requires disclosure', () => {
    expect(requires(61)).toBe(true);
    expect(requires(72)).toBe(true);
    expect(requires(120)).toBe(true);
  });

  it('null/undefined ageMonths → no disclosure (treated as 0)', () => {
    expect(requires(null)).toBe(false);
    expect(requires(undefined)).toBe(false);
  });
});
