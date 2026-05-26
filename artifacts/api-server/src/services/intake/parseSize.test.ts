import { describe, it, expect } from 'vitest';
import { parseSize } from './parseSize.js';

describe('parseSize()', () => {
  it('parses standard P-metric', () => {
    const r = parseSize('P225/65R17');
    expect(r).toEqual({
      raw: 'P225/65R17',
      sizeClass: 'P',
      section: 225,
      aspect: 65,
      diameter: 17,
      speedZ: false,
    });
  });

  it('parses LT', () => {
    expect(parseSize('LT265/70R17')?.sizeClass).toBe('LT');
  });

  it('parses metric (no prefix)', () => {
    const r = parseSize('225/65R17');
    expect(r?.sizeClass).toBe('METRIC');
    expect(r?.section).toBe(225);
  });

  it('parses ZR (speedZ true)', () => {
    expect(parseSize('225/45ZR17')?.speedZ).toBe(true);
  });

  it('rejects garbage', () => {
    expect(parseSize('hello')).toBeNull();
    expect(parseSize('')).toBeNull();
    expect(parseSize(null)).toBeNull();
    expect(parseSize(undefined)).toBeNull();
  });

  it('rejects out-of-range', () => {
    expect(parseSize('P900/65R17')).toBeNull(); // section too big
    expect(parseSize('P225/99R17')).toBeNull(); // aspect too big
    expect(parseSize('P225/65R99')).toBeNull(); // diameter too big
  });

  it('rejects flotation sizes', () => {
    expect(parseSize('33X12.50R15')).toBeNull();
  });

  it('tolerates whitespace', () => {
    expect(parseSize('  P225 / 65 R 17  ')?.section).toBe(225);
  });
});
