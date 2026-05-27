# RubberIQ — PROGRESS

Session handoff per CLAUDE.md. Read at start of every session. Under 100 lines.

## Live URLs
- **App** (default): https://rubberiq-yb7xf.ondigitalocean.app
- **Custom domain**: https://getrubberiq.com
- **Repo (public)**: https://github.com/KrewHuddle/rubberiq
- **DO App ID**: `99a9cb14-c8f9-45e0-a0b3-5f20c86fc6fa`
- **DB**: `rubberiq` on cluster `guru-boxz-db` (`2844a349-7820-47de-85e1-706a56a6de65`), 24 tables, seeded.

## Demo credentials (set 2026-05-26)
- **Platform super-admin**: `admin@rubberiq.com` / `Glass@1995` (no shopSlug)
- **Shop owner**: `owner@demo.rubberiq.com` / `Glass@1995` + shopSlug `demo`
- Rotate before real go-live.

## Completed

### Phase 0 (foundation)
pnpm monorepo · Drizzle schema (24 tables) · Express 5 + TS strict API · auth/roles · Heat-Amber design system · en/es i18n · React 19 + Vite 7 + PWA.

### Phase 1 (the moat — AI intake)
Vision parse (Anthropic Opus) → deterministic parsers (size, DOT) → grading rules → pricing rules → tire row + auto-scrap on FAIL (one DB tx). PWA camera. **58 vitest passing**.

### Phase 2 (sellable v1)
Shop dashboard (5 KPIs · 30s refetch) · Sale-doc generator (Module 11 + canvas signature + age-disclosure >60mo) · Disposal queue + NC/PA manifests (Module 12 shop-side) · Sales-agent + commissions (Module 14) · Super-admin tabbed shell (`/admin/{,shops,agents,plans,commissions,health,alerts}`) · React landing · `GRADING_CONFIG_JSON` env-driven.

### Phase 2.5 (go-to-market)
Module 16 health aggregator (28d, 70/40 bands) · Module 17 alert emission (band downgrade → `account_alerts`) · Module 18 electronic onboarding state machine + routes.

### 2026-05-26 production fixes
1. DO ingress strips `/api` prefix despite `preserve_path_prefix: true` (DO bug). Fixed via dual-mount Express routes `['/api/auth','/auth']` in `artifacts/api-server/src/index.ts` — commit **721f2e3**.
2. `JWT_SECRET` corrupted by spec round-trip (encrypted EV[] re-stored as plaintext). Reset to 64-char plaintext via `doctl apps update --spec`.
3. RubberIQ app missing from `guru-boxz-db` firewall trusted sources → login DB queries hung silently. Added `app:99a9cb14-...` rule.
4. `usePrincipal` only listened to cross-tab `storage` event → post-login same-tab state stayed null → redirected to landing not dashboard. Added custom `rb-principal-change` event in `savePrincipal/clearPrincipal` — commit **a1b501d**.
5. Active deploy: **171c6023**. Both logins return HTTP 200 + correct principal. Browser redirect confirmed pending user verification.

## Not yet verified
- **GRADING_CONFIG_JSON in DO console is garbage** (JWT-hex placeholder). Intake will 500 until real JSON per `docs/grading-config.md` is set.
- **ANTHROPIC_API_KEY in DO console is garbage**. Vision fails until set to real `sk-ant-...`.
- Live end-to-end tire snap never run against prod.
- Browser sign-in redirect (admin → `/admin`) not yet eyeballed post-deploy a1b501d.

## NEXT SESSION — execute master build prompt (sections A–G)

User pasted a master build prompt 2026-05-26 covering all remaining scope. Execute in this order (matches user's recommended sequence):

1. **G3 auth follow-through** — verify JWT_SECRET reset invalidated pre-reset tokens; verify onboarding one-shot temp-pw round-trip with new secret.
2. **A — POS (Module 10)** — new ticket UI, line items (used/new/labor/service/disposal_fee), customer+vehicle attach, auto disposal fee by shop.state, estimates→invoice, PaymentProvider interface (Connect live, Terminal stub), inventory decrement on sale, sale-doc trigger, age sign-off gate. Routes `/api/shop/pos/tickets[/...]`.
3. **B — Inventory + CRM views** — tire list + filters + bin edit + hold-for-customer + aging report; customer/vehicle CRM tied to vehicle history.
4. **C — Shop self-serve admin** — staff invite/role/remove; shop settings (pricing floors, disposal-fee by state, branding, hours, network sharing).
5. **G1 — Live AI intake on prod** — NEEDS USER to set real `GRADING_CONFIG_JSON` + `ANTHROPIC_API_KEY` in DO console (encrypted secrets can't round-trip via spec — see memory). Run real tire end-to-end after.
6. **D — Super-admin gaps** — tenant suspend/reactivate + impersonate (audit-logged); subscription billing (shops pay platform — separate from agent commissions); platform metrics; salesperson eval + goals (Module 17 UI); verified hauler/facility directory CRUD.
7. **E — Cross-shop marketplace (Module 9)** — `networkSharingSettings` + `tireTransfers` schema; bidirectional radius search; buy-first then swap; never expose bin location; price exposure toggle.
8. **F — Disposal dispatch (Module 12b/c)** — `scrapPickupRequests` schema; dispatch queue; route batching (tires-until-full); per-stop manifest reuse; fee reconciliation.
9. **G2 — Demo/sandbox mode (Module 18 extension)** — sales-agent toggle loads seeded sandbox shop, isolated, one-click reset.

## Global rules (every section)
- Heat-Amber primitives only (Button/Card/Badge/GradeStamp/PriceTag/DataTable/StatTile). No one-off styles. No Inter/Roboto/Arial. No purple-on-white.
- All strings via i18n (en + es).
- Platform-vs-shop principal split + tenant scoping on every route.
- `GRADING_CONFIG_JSON` env-driven, never logged.
- Vitest coverage per service (match 58-test bar).
- Migrations only, never hand-edit prod tables.

## Open external blockers
- Stripe Terminal hardware/SDK confirmation (Section A3 Terminal adapter).
- Wholesaler partner choice (Tirewire vs TireConnect) — Phase 3.
- NC hauler registration + permitted facility (operational switch-on for Section F).
- USPTO check: RUBBERIQ classes 009 + 042.
- `guruboxz` org doesn't exist yet — when created, `gh repo transfer KrewHuddle/rubberiq guruboxz`.
- Legal-Spanish review on landing + disclosure copy.
