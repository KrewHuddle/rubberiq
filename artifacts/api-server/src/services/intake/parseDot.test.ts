import { describe, it, expect } from 'vitest';
import { parseDot } from './parseDot.js';

const NOW = new Date('2026-05-26T00:00:00Z');

describe('parseDot()', () => {
  it('parses standard post-2000 DOT with trailing WWYY', () => {
    const r = parseDot('DOT B92T HM8R 2823', NOW);
    expect(r?.week).toBe(28);
    expect(r?.year).toBe(2023);
    expect(r?.preY2K).toBe(false);
    // ~33 months May 2026 vs ~Jul 2023
    expect(r?.ageMonths).toBeGreaterThanOrEqual(30);
    expect(r?.ageMonths).toBeLessThanOrEqual(36);
  });

  it('flags pre-Y2K 3-digit suffix', () => {
    const r = parseDot('DOT XX YY 015', NOW);
    expect(r?.preY2K).toBe(true);
    expect(r?.year).toBeLessThan(2000);
    expect(r?.ageMonths).toBeGreaterThan(72 * 3); // very old
  });

  it('returns null for garbage', () => {
    expect(parseDot('not a dot', NOW)).toBeNull();
    expect(parseDot('', NOW)).toBeNull();
    expect(parseDot(null, NOW)).toBeNull();
  });

  it('rejects invalid week numbers', () => {
    // 7723 -> week 77 invalid
    expect(parseDot('DOT 7723', NOW)).toBeNull();
  });

  it('handles two-digit year ambiguity correctly', () => {
    // current YY=26 in NOW; "0599" should be 1999 (older)
    const r = parseDot('DOT 0599', NOW);
    expect(r?.year).toBe(1999);
    expect(r?.preY2K).toBe(true);
  });
});
