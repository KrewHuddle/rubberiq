# Grading config — `GRADING_CONFIG_JSON`

The grading engine (`api-server/src/services/grading/rules.ts`) is fully
deterministic but takes its bands from a JSON env var at boot. This keeps the
public repo from shipping the per-shop / per-cohort tuning that is the actual
moat.

## Required

Set `GRADING_CONFIG_JSON` to a JSON blob matching the shape below. The engine
validates on first use. In `NODE_ENV=production` the engine throws at startup
if the var is missing — no silent fallback.

## Schema

```ts
{
  treadBands: Array<{
    min: number;          // inclusive lower bound, in 32nds of an inch
    grade: 'A' | 'B' | 'C' | 'D' | 'FAIL';
  }>;
  ageBands: Array<{
    maxMonths: number | 'infinity';   // inclusive upper bound, in months
    grade: 'A' | 'B' | 'C' | 'D' | 'FAIL';
  }>;
  hardFailFlags: string[];            // e.g. 'sidewall_damage', 'cord_exposed'
  treadHardFailMax: number;           // tread ≤ this → FAIL no matter what
  ageHardFailMaxMonths: number;       // age > this → FAIL no matter what
}
```

## Example skeleton

These are placeholder numbers — replace with the actual production tuning
before deploy.

```json
{
  "treadBands": [
    { "min": 99, "grade": "A" },
    { "min": 99, "grade": "B" },
    { "min": 99, "grade": "C" },
    { "min": 99, "grade": "D" },
    { "min": 0,  "grade": "FAIL" }
  ],
  "ageBands": [
    { "maxMonths": 99, "grade": "A" },
    { "maxMonths": 99, "grade": "B" },
    { "maxMonths": 99, "grade": "C" },
    { "maxMonths": 99, "grade": "D" },
    { "maxMonths": "infinity", "grade": "FAIL" }
  ],
  "hardFailFlags": [
    "sidewall_damage", "sidewall_bulge", "cord_exposed",
    "belt_separation", "bead_damage"
  ],
  "treadHardFailMax": 2,
  "ageHardFailMaxMonths": 72
}
```

## Operational setup

- **Local dev**: set `GRADING_CONFIG_JSON='{...}'` in your shell `.env` (NOT in
  the public repo). One-liner: `export GRADING_CONFIG_JSON="$(cat ~/secrets/rubberiq-grading.json)"`.
- **CI**: leave unset — tests install a fixture via `setGradingConfig()` so
  builds pass on the public repo without leaking values.
- **DO App Platform**: set as a `SECRET`-scoped env var. The shape lives in
  `.do/app.yaml`; the value is set once via console (or `doctl apps update
  <APP_ID> --spec .do/app.yaml` after editing the spec offline).

## Updating bands

1. Change the JSON in your local source-of-truth file (NOT this repo).
2. Roll the value into DO App Platform secrets via console.
3. Redeploy the api service.

No code change needed — the engine reloads on next boot.

## Why this layout

Per `CLAUDE.md` core thesis #2: "Deterministic AI grading + pricing… the
grading constants are a trade secret — keep tunable and private." Source-code
inlining was the original Phase 1 implementation; moving to env-loaded config
is the prerequisite for making the repo public without exposing the moat.
