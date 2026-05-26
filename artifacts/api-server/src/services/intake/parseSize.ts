/**
 * Deterministic tire-size parser.
 *
 * Supported formats:
 *   P-metric / metric: [P|LT|ST]?WWW/AARDD            e.g. P225/65R17, LT265/70R17, 225/65R17
 *   Euro/ZR speed-rating prefix: WWW/AARZRDD          e.g. 225/45ZR17 (handled as R with speed Z*)
 *
 * Aspect ratio is optional in some flotation sizes (e.g. 33X12.50R15LT) — we
 * intentionally REJECT those here; flotation goes through a separate path
 * (Phase 1 covers passenger/LT only).
 *
 * Returns null when the input doesn't match a known passenger/LT pattern; the
 * caller treats null as low confidence and routes to intake_review.
 */

export type SizeClass = 'P' | 'LT' | 'ST' | 'METRIC';

export type ParsedSize = {
  raw: string;       // canonical form, e.g. "P225/65R17"
  sizeClass: SizeClass;
  section: number;   // 225
  aspect: number;    // 65
  diameter: number;  // 17
  speedZ: boolean;   // true if ZR (high-perf)
};

const RE = /^\s*(P|LT|ST)?\s*(\d{3})\s*\/\s*(\d{2})\s*(Z?R)\s*(\d{2})\s*$/i;

export function parseSize(input: string | null | undefined): ParsedSize | null {
  if (!input) return null;
  const m = input.match(RE);
  if (!m) return null;

  const prefix = (m[1] ?? '').toUpperCase();
  const section = Number(m[2]);
  const aspect = Number(m[3]);
  const construction = m[4]!.toUpperCase();
  const diameter = Number(m[5]);

  if (!Number.isFinite(section) || section < 125 || section > 355) return null;
  if (!Number.isFinite(aspect) || aspect < 25 || aspect > 85) return null;
  if (!Number.isFinite(diameter) || diameter < 10 || diameter > 26) return null;

  const sizeClass: SizeClass =
    prefix === 'P' ? 'P' : prefix === 'LT' ? 'LT' : prefix === 'ST' ? 'ST' : 'METRIC';

  const canonical = `${prefix ? prefix : ''}${section}/${aspect}${construction.startsWith('Z') ? 'ZR' : 'R'}${diameter}`;

  return {
    raw: canonical,
    sizeClass,
    section,
    aspect,
    diameter,
    speedZ: construction.startsWith('Z'),
  };
}
