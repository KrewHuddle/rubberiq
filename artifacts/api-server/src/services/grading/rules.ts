/**
 * Grading engine — deterministic A/B/C/D/FAIL classification for used tires.
 *
 * SAME INPUTS MUST PRODUCE THE SAME GRADE. No randomness, no LLM, no clock.
 *
 * Industry-standard safety floor (public knowledge, federally regulated):
 *   - tread ≤ 2/32"   → FAIL  (US legal minimum wear bar)
 *   - age   > AGE_HARD_FAIL_MAX_MONTHS → FAIL (per loaded config)
 *
 * Tunable bands (TREAD_BANDS · AGE_BANDS · HARD_FAIL_FLAGS) live in the
 * `GRADING_CONFIG_JSON` env var (a JSON blob loaded at boot). They are NOT
 * checked into source — that lets the public repo ship the engine without
 * exposing the per-shop / per-RubberIQ tuning that is the actual moat.
 *
 *   GRADING_CONFIG_JSON shape:
 *     {
 *       "treadBands":  [{ "min": <int>, "grade": "A"|"B"|"C"|"D"|"FAIL" }, ...],
 *       "ageBands":    [{ "maxMonths": <int|"infinity">, "grade": "..." }, ...],
 *       "hardFailFlags":     ["sidewall_damage", ...],
 *       "treadHardFailMax":  2,
 *       "ageHardFailMaxMonths": 72
 *     }
 *
 * In tests, install a fixture via `setGradingConfig(fixture)` before exercising
 * the engine — see rules.test.ts for the test fixture.
 *
 * Effective grade = MIN(treadGrade, ageGrade, ...flagOverrides).
 * Any FAIL component → overall FAIL → tire NEVER sellable; auto-route to scrap.
 */

export type Grade = 'A' | 'B' | 'C' | 'D' | 'FAIL';

export type GradeReason = {
  treadGrade: Grade;
  ageGrade: Grade;
  flags: string[]; // 'sidewall_damage' | 'plug_count' | 'uneven_wear' | ...
  effective: Grade;
  notes?: string;
};

export type GradeInput = {
  treadDepth32nds?: number | null;
  ageMonths?: number | null;
  flags?: string[];
  /** Operator-tagged defect — always forces FAIL. */
  overrideFail?: boolean;
};

export type TreadBand = { min: number; grade: Grade };
export type AgeBand = { maxMonths: number; grade: Grade };

export type GradingConfig = {
  treadBands: TreadBand[];
  ageBands: AgeBand[];
  hardFailFlags: string[];
  /** Tread depth (in 32nds) at or below which the tire FAILS unconditionally. */
  treadHardFailMax: number;
  /** Age (in months) above which the tire FAILS unconditionally. */
  ageHardFailMaxMonths: number;
};

/* ------------------------------------------------------------------------- */

let _config: GradingConfig | null = null;
let _hardFailFlagSet: Set<string> | null = null;

function parseEnvConfig(): GradingConfig | null {
  const raw = process.env.GRADING_CONFIG_JSON;
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(
      `GRADING_CONFIG_JSON is not valid JSON: ${e instanceof Error ? e.message : 'parse_error'}`,
    );
  }
  return validateConfig(parsed);
}

function validateConfig(x: unknown): GradingConfig {
  if (!x || typeof x !== 'object') throw new Error('grading config must be an object');
  const o = x as Record<string, unknown>;
  const treadBands = asTreadBands(o.treadBands);
  const ageBands = asAgeBands(o.ageBands);
  const hardFailFlags = asStringArray(o.hardFailFlags, 'hardFailFlags');
  const treadHardFailMax = asNumber(o.treadHardFailMax, 'treadHardFailMax');
  const ageHardFailMaxMonths = asNumber(o.ageHardFailMaxMonths, 'ageHardFailMaxMonths');
  if (treadBands.length === 0) throw new Error('treadBands must be non-empty');
  if (ageBands.length === 0) throw new Error('ageBands must be non-empty');
  return { treadBands, ageBands, hardFailFlags, treadHardFailMax, ageHardFailMaxMonths };
}

function asTreadBands(x: unknown): TreadBand[] {
  if (!Array.isArray(x)) throw new Error('treadBands must be an array');
  return x.map((b, i) => {
    if (!b || typeof b !== 'object') throw new Error(`treadBands[${i}] must be an object`);
    const obj = b as Record<string, unknown>;
    return { min: asNumber(obj.min, `treadBands[${i}].min`), grade: asGrade(obj.grade, `treadBands[${i}].grade`) };
  });
}

function asAgeBands(x: unknown): AgeBand[] {
  if (!Array.isArray(x)) throw new Error('ageBands must be an array');
  return x.map((b, i) => {
    if (!b || typeof b !== 'object') throw new Error(`ageBands[${i}] must be an object`);
    const obj = b as Record<string, unknown>;
    const maxRaw = obj.maxMonths;
    let max: number;
    if (maxRaw === 'infinity' || maxRaw === 'Infinity') {
      max = Number.POSITIVE_INFINITY;
    } else if (typeof maxRaw === 'number' && maxRaw === Number.POSITIVE_INFINITY) {
      max = Number.POSITIVE_INFINITY;
    } else {
      max = asNumber(maxRaw, `ageBands[${i}].maxMonths`);
    }
    return { maxMonths: max, grade: asGrade(obj.grade, `ageBands[${i}].grade`) };
  });
}

function asStringArray(x: unknown, key: string): string[] {
  if (!Array.isArray(x)) throw new Error(`${key} must be an array of strings`);
  return x.map((s, i) => {
    if (typeof s !== 'string') throw new Error(`${key}[${i}] must be a string`);
    return s;
  });
}

function asNumber(x: unknown, key: string): number {
  if (typeof x !== 'number' || !Number.isFinite(x)) throw new Error(`${key} must be a finite number`);
  return x;
}

const VALID_GRADES: ReadonlySet<Grade> = new Set(['A', 'B', 'C', 'D', 'FAIL']);

function asGrade(x: unknown, key: string): Grade {
  if (typeof x !== 'string' || !VALID_GRADES.has(x as Grade)) {
    throw new Error(`${key} must be one of A | B | C | D | FAIL`);
  }
  return x as Grade;
}

/**
 * Resolve the active grading config. Loads from env on first call.
 * Throws in production if missing — refusing to fall back protects the moat
 * and surfaces deploy-config bugs at boot, not after a tire is mispriced.
 */
function getConfig(): GradingConfig {
  if (_config) return _config;
  const fromEnv = parseEnvConfig();
  if (fromEnv) {
    _config = fromEnv;
    _hardFailFlagSet = new Set(fromEnv.hardFailFlags);
    return fromEnv;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'GRADING_CONFIG_JSON not set in production. Refusing to grade with undefined bands.',
    );
  }
  throw new Error(
    'GRADING_CONFIG_JSON not set. Tests must call setGradingConfig() before grading; non-prod runtime must set the env var.',
  );
}

/** Install a config explicitly — tests + manual reconfig only. */
export function setGradingConfig(config: GradingConfig): void {
  _config = validateConfig(config);
  _hardFailFlagSet = new Set(_config.hardFailFlags);
}

/** Drop the cached config (tests). */
export function resetGradingConfig(): void {
  _config = null;
  _hardFailFlagSet = null;
}

/* ------------------------------------------------------------------------- */

const ORDER: Grade[] = ['A', 'B', 'C', 'D', 'FAIL'];

function worseOf(a: Grade, b: Grade): Grade {
  return ORDER.indexOf(a) >= ORDER.indexOf(b) ? a : b;
}

function gradeTread(tread: number | null | undefined, cfg: GradingConfig): Grade {
  if (tread == null || !Number.isFinite(tread)) return 'D'; // unknown — conservative
  if (tread <= cfg.treadHardFailMax) return 'FAIL';
  for (const band of cfg.treadBands) {
    if (tread >= band.min) return band.grade;
  }
  return 'FAIL';
}

function gradeAge(months: number | null | undefined, cfg: GradingConfig): Grade {
  if (months == null || !Number.isFinite(months)) return 'D'; // unknown — conservative
  if (months > cfg.ageHardFailMaxMonths) return 'FAIL';
  for (const band of cfg.ageBands) {
    if (months <= band.maxMonths) return band.grade;
  }
  return 'FAIL';
}

export function grade(input: GradeInput): GradeReason {
  const cfg = getConfig();
  const flags = (input.flags ?? []).filter(Boolean);
  const treadGrade = gradeTread(input.treadDepth32nds, cfg);
  const ageGrade = gradeAge(input.ageMonths, cfg);

  const hardFlag = flags.find((f) => _hardFailFlagSet!.has(f));
  const overrideFail = input.overrideFail === true;

  let effective: Grade = worseOf(treadGrade, ageGrade);
  if (hardFlag || overrideFail) effective = 'FAIL';

  return {
    treadGrade,
    ageGrade,
    flags,
    effective,
    notes: hardFlag
      ? `hard-fail flag: ${hardFlag}`
      : overrideFail
        ? 'operator override'
        : undefined,
  };
}

/** Convenience: is this tire sellable per grading? Never sell a FAIL. */
export function isSellable(g: Grade): boolean {
  return g !== 'FAIL';
}
