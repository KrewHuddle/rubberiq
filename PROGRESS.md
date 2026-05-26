# RubberIQ — PROGRESS

Session handoff per CLAUDE.md. Update on every "wrap up". Keep under 100 lines.

## Completed

### Phase 0 (foundation)
pnpm monorepo · Drizzle schema · Express 5 + TS strict API · Sentry ESM · auth + role middleware · tier routes · React 19 + Vite 7 + Tailwind 4 + PWA · design system Module 1 (Heat Amber) · i18n en/es.

### Phase 1 (the moat — AI intake)
visionParse (Anthropic Opus) · parseSize · parseDot · grading rules (trade-secret) · pricing rules · createTireFromPhoto (vision → parsers → grade → price → tire row in one DB tx) · PWA camera capture · IntakePage · 27 vitest passing.

### Phase 2 (sellable v1)
- **B3 seed**: `scripts/src/seed.ts` (1 shop `demo` NC, 1 owner `owner@demo.rubberiq.com`, 1 super-admin `admin@rubberiq.com`; idempotent; refuses fallback passwords on non-local DB). `pnpm db:seed`.
- **B5 dashboard wired**: `/api/shop/stats` endpoint (in-stock · sold today · revenue today · scrap on hand · intake review). TanStack Query in `main.tsx`. `ShopDashboardPage` fetches every 30s, formats USD per locale, error banner on miss.
- **B7 sale-doc generator (Module 11)**: `services/saleDocs/generate.ts` (idempotent per invoice+tire, age-disclosure auto-flag at >60mo) · `services/saleDocs/render.ts` (self-contained HTML, en/es, photos + grade + age disclosure block + signature area) · routes `POST /sale-docs`, `GET /:id`, `GET /:id/html`, `POST /:id/sign` · web `SaleDocPage` with iframe + canvas signature pad.
- **B8 disposal queue (Module 12 shop-side)**: `services/disposal/queue.ts` (enqueue → schedule haul → pickup → deliver) · `services/disposal/manifest.ts` (NC Scrap-Tire Cert or PA Act 90 by hauler state) · routes `POST /scrap`, `POST /hauls`, `POST /:id/pickup`, `POST /:id/deliver`, `GET /:id/manifest` · web `ScrapQueuePage` with batch-select + schedule + manifest link.
- **A landing port**: `web/src/pages/LandingPage.tsx` rewritten as Manifesto-shaped layout against Phase 0 tokens (Heat Amber + Space Grotesk + IBM Plex). Hero copy+SVG · payoff bar · brand band · 5 numbered sections w/ poster glyphs · final CTA · footer. Used-tire only copy (no oil-change). `landing.json` en+es regenerated for new key shape.

## Verified

- `pnpm install` clean.
- `pnpm --filter @rubberiq/api-server typecheck` ✓
- `pnpm --filter @rubberiq/web typecheck` ✓
- `pnpm --filter @rubberiq/scripts typecheck` ✓
- `pnpm --filter @rubberiq/api-server test` → **27 passed** (Phase 1 tests unaffected).
- `pnpm --filter @rubberiq/api-server build` → dist emitted.
- `pnpm --filter @rubberiq/web build` → dist + PWA SW.
- Visual: `/` landing renders (Heat Amber Manifesto), `/dashboard` KPI tiles render real `0` not `—` with retry-error banner, `/scrap` queue empty-state cards render.

## Done (this session — continued)

### Code review (caveman:cavecrew-reviewer)
- Real fixes applied: scheduledFor future-only validator on `ScheduleHaulBody`; manifest tire-row mismatch warn; locked-at-creation comment on `ageDisclosureRequired`; ScrapQueuePage scheduled-date input added.
- False positives dismissed: query.lang narrow IS valid; `n ?? 0` in dashboard formatter handles undefined; ageDisclosureRequired immutability is intentional.

### Tests (vitest · 55 / 55 ✓ · up from 27)
- `services/disposal/manifest.test.ts` — `esc()` HTML escape + `selectManifestTemplate()` (NC default · PA on hauler state).
- `services/saleDocs/threshold.test.ts` — `AGE_DISCLOSURE_MONTHS` pinned at 60mo + threshold boundary.
- `services/db.test.ts` — `buildPoolConfig()` URL parser + SSL behavior across sslmode values + URL-encoded user/pw.
- `services/sales/commission.test.ts` — flat + percent signup; life vs N-month residual term; upsell bps.

### Module 14 — sales-agent + commissions
- `services/sales/commission.ts` — pure compute: `computeSignupCents`, `computeResidualCents`, `computeUpsellCents` against `commission_plans` row.
- `services/sales/agents.ts` — `createAgent` (creates platform_user + sales_agent + temp password) and `assignShopToAgent` (creates `agent_accounts` + sets `shops.attributedAgentId` + emits signup `commission_events` row if plan attached).
- `routes/admin.ts` rewritten — Module 14 routes live: `GET/POST /agents`, `GET /agents/:id/accounts`, `POST /agents/:id/assign`, `GET/POST /commission-plans`, `GET /commissions[?agentId=]`, `GET /health[?shopId=]`, `GET /alerts`, `GET /haulers`, `GET /facilities`. All super-admin-gated.
- `lib/db` rebuilt — `dist/` regenerated so workspace consumers see `buildPoolConfig` export.

## Done (this session)

- **B1 DB provision** ✓ via `doctl databases db create 2844a349-… rubberiq`
- **DO firewall** ✓ current IP added (`67.197.13.148`)
- **B2 migrations** ✓ `drizzle-kit generate` → `migrations/0000_icy_umar.sql` (24 tables) → `pnpm db:migrate` applied. Verified `\dt` returns 24 tables.
- **B3 seed** ✓ `pnpm db:seed` created shop `demo` (id `08992a20…`) + owner `owner@demo.rubberiq.com` (id `7c12a1ac…`) + super-admin `admin@rubberiq.com` (id `62e62681…`). Idempotent confirm on second run.
- **SSL fix in code** — `lib/db/src/index.ts` now exports `buildPoolConfig(url)` that parses URL parts and sets `ssl: { rejectUnauthorized: false }` when `sslmode=require/verify-ca/verify-full`. Migrate + getDb both use it. No more `NODE_TLS_REJECT_UNAUTHORIZED=0` hack needed.

**Credentials (record from terminal output above — won't print again):**
- DATABASE_URL: `postgresql://doadmin:<pw>@guru-boxz-db-do-user-35331205-0.d.db.ondigitalocean.com:25060/rubberiq?sslmode=require`
- DB password: visible via `doctl databases connection 2844a349-7820-47de-85e1-706a56a6de65 --format URI`
- Owner: `owner@demo.rubberiq.com` / `<seeded — see terminal>`
- Admin: `admin@rubberiq.com` / `<seeded — see terminal>`

## Not yet verified

- End-to-end intake against live Anthropic key (Phase 1 pipeline compiles + tests pass, never run against live key).
- Sale-doc signature flow + manifest render never run against a real haul.

## Exact next steps

**B4 (you)** — write to `.env` (Claude can't touch `.env*` per security rule):

```
DATABASE_URL=postgresql://doadmin:<pw>@guru-boxz-db-do-user-35331205-0.d.db.ondigitalocean.com:25060/rubberiq?sslmode=require
JWT_SECRET=<openssl rand -hex 32>
ANTHROPIC_API_KEY=sk-ant-...
WEB_ORIGIN=http://localhost:5173
PORT=3000
NODE_ENV=development
```

Then:
```
pnpm dev:api    # one terminal
pnpm dev:web    # another terminal
```

Log in at `http://localhost:5173/sign-in` as the seeded owner. Hit `/intake` and snap a real tire to validate end-to-end (vision → grade → price → tire row).

**Phase 2.5 (next build cycle)** — POS + Stripe Terminal (Module 10, re-check Stripe Terminal docs first), super-admin + sales-agent role (Module 14), commission engine, account health scores, electronic onboarding, disposal-service hauler dispatch (12b–c).

## Open decisions / blockers (carry forward)

- **Stripe Terminal**: verify current capabilities/Tap-to-Pay device support against live Stripe docs before building Module 10.
- **Wholesaler partner**: Tirewire vs TireConnect — adapter-first; outreach in flight. Blocks Phase 3.
- **Commission rates**: configurable; set against real margins/CAC pre-launch.
- **Grading constants**: trade secret; live in `services/grading/rules.ts` only.
- **Legal Spanish**: starter strings in `es/landing.json` and en/es disclosure copy — legal-fluent review before launch.
- **Trademark/domain**: confirm RUBBERIQ at tmsearch.uspto.gov (009, 042); register `rubberiq.com`.
- **Standalone HTML landing** at `artifacts/landing.html` (sodium-vapor green, Bricolage Grotesque) is a separate marketing artifact from the React landing. Decide whether to ship standalone separately or retire.
