/**
 * DOT-code decoder — extracts manufacture week/year and computes ageMonths.
 *
 * Format (current, post-2000): DOT prefix optional, last 4 digits are WWYY
 *   e.g. "DOT B92T HM8R 2823" -> week 28, year 2023
 *
 * Format (pre-2000): last 3 digits are WWY (single-digit decade) — flagged
 * because pre-2000 tires are AT LEAST 25 years old and almost certainly FAIL.
 *
 * Conservative: when the trailing-week portion is not a sensible 01–53, we
 * return null and the caller treats it as low-confidence.
 */

export type ParsedDot = {
  raw: string;        // the cleaned DOT string we matched
  week: number;       // 1-53
  year: number;       // 4-digit
  ageMonths: number;  // computed against `now`
  preY2K: boolean;    // 3-digit suffix
};

const RE_4 = /(\d{2})(\d{2})(?:\D|$)/; // WWYY at end
const RE_3 = /(\d{2})(\d)(?:\D|$)/;    // WWY at end (legacy)

function ageMonths(week: number, year: number, now: Date): number {
  // Approximate: week 1 starts Jan 1; one ISO week ≈ 7 days.
  const stamped = new Date(Date.UTC(year, 0, 1 + (week - 1) * 7));
  const months =
    (now.getUTCFullYear() - stamped.getUTCFullYear()) * 12 +
    (now.getUTCMonth() - stamped.getUTCMonth());
  return Math.max(0, months);
}

export function parseDot(input: string | null | undefined, now: Date = new Date()): ParsedDot | null {
  if (!input) return null;
  const cleaned = input.toUpperCase().replace(/\s+/g, ' ').trim();

  // Try post-2000 4-digit suffix first.
  const m4 = cleaned.match(/(\d{4})(?!\d)/g)?.at(-1); // last 4-digit run not followed by another digit
  if (m4) {
    const week = Number(m4.slice(0, 2));
    const yy = Number(m4.slice(2, 4));
    // Two-digit-year ambiguity: 00–current year → 20YY; 25 years older → 19YY.
    const currentYY = now.getUTCFullYear() % 100;
    const year = yy <= currentYY ? 2000 + yy : 1900 + yy;
    if (week >= 1 && week <= 53) {
      return {
        raw: m4,
        week,
        year,
        ageMonths: ageMonths(week, year, now),
        preY2K: year < 2000,
      };
    }
  }

  // Legacy 3-digit
  const m3 = cleaned.match(/(\d{3})(?!\d)/g)?.at(-1);
  if (m3) {
    const week = Number(m3.slice(0, 2));
    const y = Number(m3.slice(2, 3));
    const year = 1990 + y; // 90s decade only — anything earlier wraps via the partial-suffix flag
    if (week >= 1 && week <= 53) {
      return {
        raw: m3,
        week,
        year,
        ageMonths: ageMonths(week, year, now),
        preY2K: true,
      };
    }
  }

  return null;
}
