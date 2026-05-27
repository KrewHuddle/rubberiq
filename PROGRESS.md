# RubberIQ — PROGRESS

Session handoff per CLAUDE.md. Read at start of every session. Under 100 lines.

## Live URLs
- **App** (default): https://rubberiq-yb7xf.ondigitalocean.app
- **Custom domain**: https://getrubberiq.com (LE cert may still be provisioning)
- **Repo (public)**: https://github.com/KrewHuddle/rubberiq
- **DO App ID**: `99a9cb14-c8f9-45e0-a0b3-5f20c86fc6fa`
- **DB**: `rubberiq` on cluster `guru-boxz-db` (`2844a349-7820-47de-85e1-706a56a6de65`), 24 tables, seeded.

## Completed

### Phase 0 (foundation)
pnpm monorepo · Drizzle schema (24 tables) · Express 5 + TS strict API · auth/roles · Heat-Amber design system · en/es i18n · React 19 + Vite 7 + PWA.

### Phase 1 (the moat — AI intake)
Vision parse (Anthropic Opus) → deterministic parsers (size, DOT) → deterministic grading rules → pricing rules → tire row + auto-scrap on FAIL (one DB tx). PWA camera. **58 vitest passing** (grading, pricing, parsers, manifest, sale-doc threshold, db SSL parser, commission compute).

### Phase 2.5 (go-to-market)
- **Module 16 health aggregator**: `services/health/score.ts` (pure 5-part rubric, 70/40 thresholds) + `services/health/aggregate.ts` (per-shop 28d window: login recency, intake, paid invoices, last-invoice-void as payment-failed proxy; upserts `health_signals`, mirrors to `shops.health{Score,Band,UpdatedAt}`). **Module 17 alert emission** wired: band downgrade → `account_alerts` row (`churn_risk` or `dormant`, severity 2/3, routed to attributed agent). Runner: `pnpm --filter @rubberiq/api-server health:aggregate`.

### Phase 2 (sellable v1)
- **Shop dashboard**: `/api/shop/stats` (5 KPIs · 30s refetch) wired to `ShopDashboardPage`.
- **Sale-doc generator (Module 11)**: `services/saleDocs/{generate,render}.ts` + routes (`POST /sale-docs`, `GET /:id/html`, `POST /:id/sign`) + `SaleDocPage` with canvas signature pad + age-disclosure auto-flag at >60mo.
- **Disposal queue (Module 12 shop-side)**: `services/disposal/{queue,manifest}.ts` + routes + `ScrapQueuePage` with batch-select, hauler/facility/scheduled-date inputs, NC + PA manifest renderers.
- **Sales-agent + commissions (Module 14)**: `services/sales/{agents,commission}.ts` + `routes/admin.ts` (187 lines · super-admin-gated). Create agent, assign shop (emits signup commission_events row), commission plan CRUD, list commissions/health/alerts.
- **Super-admin dashboard**: `/api/admin/stats` wired to OverviewPage; tabbed shell at `/admin/{,shops,agents,plans,commissions,health,alerts}` — agents create+assign, commission-plan create, commission ledger w/ agent filter, health + alerts tables. New `admin` i18n namespace (en + es).
- **React landing**: at `/` for unauthed, Heat-Amber Manifesto layout, used-tire-only copy.
- **Grading constants moved to env**: `GRADING_CONFIG_JSON` (engine throws at boot in NODE_ENV=production if missing).

### Infra
- DB provisioned on DO via `doctl databases db create`. Firewall IP added.
- Migrations generated + applied. Seed: 1 shop `demo` (NC) + owner `owner@demo.rubberiq.com` + super-admin `admin@rubberiq.com`. **Passwords in shell history only — see scrollback or re-seed.**
- SSL fix in code: `lib/db/src/index.ts` exports `buildPoolConfig(url)`. Lib package.json files use conditional exports (`workspace` → src for dev, `default` → dist for Node prod).
- DO App created from `.do/app.yaml`. Active deploy: `25add0d8`. CI green (GitHub Actions). Branch protection on `main`.
- Domain: GoDaddy `getrubberiq.com` → DO nameservers (verified via dig + WHOIS) → DO domain entry → in App `domains:` block.

## Not yet verified

- **GRADING_CONFIG_JSON in DO console is garbage** (JWT-hex placeholder I sed-substituted). Intake will 500 until real JSON is set per `docs/grading-config.md`.
- **ANTHROPIC_API_KEY in DO console is garbage** (same). Vision call fails until set to real `sk-ant-...`.
- Live end-to-end tire snap never run against prod.
- LE cert provisioning state on `getrubberiq.com` not re-checked since last session.

## Exact next steps (operator)

1. DO console: https://cloud.digitalocean.com/apps/99a9cb14-c8f9-45e0-a0b3-5f20c86fc6fa/settings → api service → Env Vars:
   - `GRADING_CONFIG_JSON` → real JSON per `docs/grading-config.md`
   - `ANTHROPIC_API_KEY` → `sk-ant-...`
   - `SENTRY_DSN` → optional, or unset
2. Save (triggers redeploy).
3. Confirm cert on `https://getrubberiq.com/` returns 200.
4. Log in as `owner@demo.rubberiq.com`, snap real tire at `/intake`, validate vision → grade → price.

## Next Claude-actionable (after operator steps)

- Module 18 onboarding step machine (`/api/onboarding/*`).
- Disposal-service (12b/c) hauler dispatch.
- POS / Module 10 — BLOCKED on Stripe Terminal docs verification.
- Phase 3 wholesaler adapter (Tirewire vs TireConnect — outreach pending).

## Open decisions / blockers (carry forward)

- Stripe Terminal capability check (blocks Module 10).
- Wholesaler partner choice (blocks Phase 3).
- USPTO check: RUBBERIQ classes 009 + 042 at tmsearch.uspto.gov.
- guruboxz GitHub org doesn't exist yet — when created, `gh repo transfer KrewHuddle/rubberiq guruboxz`.
- Legal-Spanish review on `es/landing.json` + disclosure copy before launch.
