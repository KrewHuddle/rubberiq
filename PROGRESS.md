# RubberIQ — PROGRESS

Session handoff per CLAUDE.md. Read at start of every session. Under 100 lines.

## Live URLs
- **App**: https://rubberiq-yb7xf.ondigitalocean.app · **Domain**: https://getrubberiq.com
- **Repo (public)**: https://github.com/KrewHuddle/rubberiq
- **DO App ID**: `99a9cb14-c8f9-45e0-a0b3-5f20c86fc6fa`
- **DB**: `rubberiq` on `guru-boxz-db` (`2844a349-7820-47de-85e1-706a56a6de65`), **online** 2026-09-13.

## Demo credentials (set 2026-05-26)
`admin@rubberiq.com` / `Glass@1995` (no shopSlug) · `owner@demo.rubberiq.com` / `Glass@1995` + slug `demo`.
⚠️ **This repo is public and these sit in git history — treat them as burned.** Rotate before anything
real runs; add no further credentials here. `pnpm db:seed --rotate` resets both from
`SEED_OWNER_PASSWORD` / `SEED_ADMIN_PASSWORD`.

## Completed
**Phase 0/1** — pnpm monorepo · Drizzle · Express 5 + TS strict · auth/roles · Heat-Amber design
system · en/es i18n · React 19 + Vite 7 + PWA. Vision parse → size/DOT parsers → grading → pricing →
tire row + auto-scrap on FAIL (one tx). PWA camera.
**Phase 2** — shop dashboard · sale-doc + signature pad + >60mo age disclosure (M11) · shop-side
disposal queue + NC/PA manifests (M12a) · agents + commissions (M14) · super-admin shell · landing.
**Phase 2.5** — M16 health aggregator (28d, 70/40) · M17 alert emission · M18 onboarding machine.

### M12b/12c — disposal dispatch (this session; = section F below)
Second revenue stream, platform side.
- `services/disposal/plan.ts` — **pure, no I/O**: `planRoute` ("tires until full", longest-waiting
  first, partial stops, `maxStops`) + `reconcileRouteFees` (cost split by tire share; last stop
  absorbs rounding so shares re-sum exactly). 16 unit tests.
- `services/disposal/dispatch.ts` — `getPickupQueue` (cross-shop demand), `getScrapVolumeMap`,
  `createRoute` (one tx; re-reads scrap **inside** it so a concurrent shop-side haul cannot
  double-claim; persists *claimed* not projected counts), `advanceRoute` (whole truck moves as one;
  cancel returns scrap to the queue), `reconcileRoute`.
- A stop is an ordinary `hauls` row tagged `routeId`, so NC cert / PA Act 90 output is unchanged.
- `/api/admin/disposal/{queue,scrap-map,routes}` + `routes/:id/{advance,reconcile}`; hauler/facility
  **directory CRUD + verify toggle** — `verified` gates dispatch. `DisposalPage.tsx`, en + es.
- Schema: new `dispatch_routes`; `hauls` gains `routeId`/`collectedCents`/`marginCents`/
  `reconciledAt`. Migration `0001_quiet_risque.sql` additive only, **not applied to prod**.

## 2026-05-26 production fixes
1. DO ingress strips `/api` despite `preserve_path_prefix: true` → dual-mount `['/api/auth','/auth']`,
   commit **721f2e3**. A duplicate of this fix was re-derived in 2026-09 and dropped at rebase; do not
   write it a third time.
2. `JWT_SECRET` corrupted by spec round-trip (encrypted `EV[]` re-stored as plaintext). **Encrypted
   secrets cannot round-trip** — set them by hand in the console.
3. App missing from `guru-boxz-db` firewall trusted sources → login queries hung silently.
4. `usePrincipal` only heard cross-tab `storage`; added `rb-principal-change` — commit **a1b501d**.

## Build gotcha — read before debugging TS
Stale `tsconfig.tsbuildinfo` with **no `dist/`** makes `tsc --build` skip emit → **TS6305** across
unrelated files and vitest cannot resolve `@rubberiq/db`. Fix:
`find . -name "*.tsbuildinfo" -not -path "*/node_modules/*" -delete && npx tsc --build --force`.
Not a code error. A "Done" from tsc is not proof it emitted — `ls` the output dir.

## Verification status
`pnpm typecheck` clean · **94 tests / 11 files** (was 78). Dispatch verified end-to-end on a throwaway
local Postgres (created→migrated→seeded→exercised→dropped; prod untouched): 3 shops / 140 tires;
queue oldest-first; unverified hauler → 400; capacity 100 → 60 full + 40 partial + 1 skipped;
reconcile collected 30000c, cost 10000c, margin 20000c (6667 bps), split 6000/4000; closed route → 400.
Prettier is **not** enforced and the baseline is drifted — do not mass-reformat.

## NEXT SESSION — master build prompt, in order
1. **G3 auth** — verify the `JWT_SECRET` reset killed pre-reset tokens; verify the onboarding
   one-shot temp-password round-trip under the new secret.
2. **A — POS (M10)** — tickets, line items (used/new/labor/service/disposal_fee), customer+vehicle
   attach, auto disposal fee by `shop.state`, estimates→invoice, `PaymentProvider` (Connect live,
   Terminal stub), inventory decrement, sale-doc trigger, age sign-off gate.
3. **B — Inventory + CRM** — list/filters/bin edit/hold-for-customer/aging; CRM tied to vehicle history.
4. **C — Shop self-serve admin** — staff invite/role/remove; settings (pricing floors, disposal fee by
   state, branding, hours, network sharing).
5. **G1 — Live AI intake on prod** — needs real `GRADING_CONFIG_JSON` + `ANTHROPIC_API_KEY` set by
   hand in the DO console (see fix 2).
6. **D — Super-admin gaps** — suspend/reactivate + impersonate (audit-logged); subscription billing
   (shops→platform, separate from agent commissions); platform metrics; salesperson eval + goals.
   *Hauler/facility directory CRUD is **done** — see M12c.*
7. **E — Marketplace (M9)** — `networkSharingSettings` + `tireTransfers`; bidirectional radius search;
   buy-first-then-swap; never expose bin location; price-exposure toggle.
8. ~~**F — Disposal dispatch (M12b/c)**~~ — **DONE this session.**
9. **G2 — Demo/sandbox** — agent toggle loads a seeded sandbox shop, isolated, one-click reset.

## Global rules
Heat-Amber primitives only (no one-off styles, no Inter/Roboto/Arial, no purple-on-white) · every
string via i18n (en + es) · platform-vs-shop principal split + tenant scoping on every route ·
`GRADING_CONFIG_JSON` env-driven, never logged · vitest per service · migrations only.

## Not yet verified
- **Migration 0001 is NOT applied to prod.** Needs `DATABASE_URL` + a go-ahead; no `.env` locally.
- `GRADING_CONFIG_JSON` / `ANTHROPIC_API_KEY` in the DO console are placeholder garbage — intake 500s
  and vision fails until set (`docs/grading-config.md`).
- Live end-to-end tire snap never run against prod.
- **The app is archived and 503s** — active deployment cause "app spec updated, app archived"
  (2026-08-28); last code deploy `8a81b18`, 2026-05-27. The DO **account is active** (verified
  2026-09-14); the 503 is archival, not a billing suspension.

## Open blockers
Disposal dispatch ships as code; switching it on needs NC hauler registration + a permitted facility ·
Stripe Terminal hardware/SDK confirmation (blocks A) · wholesaler choice Tirewire vs TireConnect
(blocks Phase 3) · USPTO RUBBERIQ classes 009 + 042 · `guruboxz` org does not exist yet (then
`gh repo transfer`) · legal-Spanish review on landing + disclosure copy (`es/admin.json` is UI copy, not legal text).
