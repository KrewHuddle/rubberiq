/**
 * Grading constants & deterministic grade() function.
 *
 * ⚠️ THIS FILE IS LIABILITY-BACKBONE AND A TRADE SECRET.
 *    - Constants tunable here ONLY (never in env, never in DB).
 *    - Do not publicly document these thresholds.
 *    - Same inputs MUST produce the same grade — no randomness, no LLM.
 *
 * Effective grade = MIN(treadGrade, ageGrade, ...flagOverrides).
 * Any FAIL component → overall FAIL → tire NEVER sellable; auto-route to scrap.
 *
 * Reference safety floor (industry-standard, not secret):
 *   tread ≤ 2/32"  → fail (US legal min wear bar)
 *   age   > 72mo   → fail (manufacturer guidance varies 6-10yr; we use 6yr)
 */

export type Grade = 'A' | 'B' | 'C' | 'D' | 'FAIL';

export type GradeReason = {
  treadGrade: Grade;
  ageGrade: Grade;
  flags: string[];          // 'sidewall_damage' | 'plug_count' | 'uneven_wear' | ...
  effective: Grade;
  notes?: string;
};

export type GradeInput = {
  treadDepth32nds?: number | null;
  ageMonths?: number | null;
  flags?: string[];
  // Optional explicit overrides — e.g. operator hand-tagged a defect.
  overrideFail?: boolean;
};

/* ---- Tunable constants (trade secret) ----------------------------------- */

const TREAD_BANDS: Array<{ min: number; grade: Grade }> = [
  { min: 8, grade: 'A' }, // A: ≥ 8/32"
  { min: 6, grade: 'B' }, // B: 6-7/32"
  { min: 4, grade: 'C' }, // C: 4-5/32"
  { min: 3, grade: 'D' }, // D: 3/32"
  { min: 0, grade: 'FAIL' }, // ≤ 2/32" → FAIL
];

const AGE_BANDS: Array<{ maxMonths: number; grade: Grade }> = [
  { maxMonths: 24, grade: 'A' },  // ≤ 2yr
  { maxMonths: 48, grade: 'B' },  // ≤ 4yr
  { maxMonths: 60, grade: 'C' },  // ≤ 5yr
  { maxMonths: 72, grade: 'D' },  // ≤ 6yr
  { maxMonths: Number.POSITIVE_INFINITY, grade: 'FAIL' },
];

/** Flags that, if present, force FAIL regardless of tread/age. */
const HARD_FAIL_FLAGS = new Set<string>([
  'sidewall_damage',
  'sidewall_bulge',
  'cord_exposed',
  'belt_separation',
  'bead_damage',
]);

/* ---- Logic -------------------------------------------------------------- */

const ORDER: Grade[] = ['A', 'B', 'C', 'D', 'FAIL'];

function worseOf(a: Grade, b: Grade): Grade {
  return ORDER.indexOf(a) >= ORDER.indexOf(b) ? a : b;
}

function gradeTread(tread: number | null | undefined): Grade {
  if (tread == null || !Number.isFinite(tread)) return 'D'; // unknown tread — conservative
  if (tread <= 2) return 'FAIL';
  for (const band of TREAD_BANDS) {
    if (tread >= band.min) return band.grade;
  }
  return 'FAIL';
}

function gradeAge(months: number | null | undefined): Grade {
  if (months == null || !Number.isFinite(months)) return 'D'; // unknown age — conservative
  for (const band of AGE_BANDS) {
    if (months <= band.maxMonths) return band.grade;
  }
  return 'FAIL';
}

export function grade(input: GradeInput): GradeReason {
  const flags = (input.flags ?? []).filter(Boolean);
  const treadGrade = gradeTread(input.treadDepth32nds);
  const ageGrade = gradeAge(input.ageMonths);

  const hardFlag = flags.find((f) => HARD_FAIL_FLAGS.has(f));
  const overrideFail = input.overrideFail === true;

  let effective: Grade = worseOf(treadGrade, ageGrade);
  if (hardFlag || overrideFail) effective = 'FAIL';

  return {
    treadGrade,
    ageGrade,
    flags,
    effective,
    notes: hardFlag ? `hard-fail flag: ${hardFlag}` : overrideFail ? 'operator override' : undefined,
  };
}

/** Convenience: is this tire sellable per grading? Never sell a FAIL. */
export function isSellable(g: Grade): boolean {
  return g !== 'FAIL';
}
