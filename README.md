# RubberIQ

AI-first operations platform for used tire shops. Built under **Guru Boxz Technologies LLC**.

> AI tire intake (photo → grade → price), deterministic grading, wholesaler integration,
> disposal/compliance, and a full go-to-market engine (sales agents, commissions,
> demo mode, electronic onboarding).

## Stack

- Node.js 20 + Express 5 (TypeScript strict)
- PostgreSQL on the `guru-boxz-db` DigitalOcean cluster (database `rubberiq`)
- Drizzle ORM
- React 19 + Vite + Tailwind 4 + framer-motion (single web app, role-gated)
- Anthropic SDK (vision intake, multilingual content)
- Stripe Connect + Stripe Terminal (tap-to-pay)
- Sentry (org `guru-boxz`, ESM `instrument.ts` entry)
- pnpm monorepo

## Repo layout

```
/artifacts/api-server   Express API (Phase 1 owns intake services)
/artifacts/web          React/Vite app — all roles, role-gated routing + PWA
/lib/db                 Drizzle schema, migrations, pool
/lib/anthropic          Anthropic client + model selection
/lib/payments           Stripe (Connect + Terminal) helpers
/scripts                One-off scripts (seeds, migrations, etc.)
```

## Quick start (after Phase 0)

```sh
pnpm install
cp .env.example .env       # fill DATABASE_URL, JWT_SECRET, ANTHROPIC_API_KEY
pnpm db:generate           # produce SQL migrations from schema
pnpm db:migrate            # apply migrations
pnpm dev:api               # API on :3001
pnpm dev:web               # web on :5173 (proxies /api -> :3001)
```

## Build phases (Phase 0 complete)

0. ✅ Repo, stack, schema, auth/roles, **design system (Module 1)**, **i18n scaffold (Module 2)**
1. AI intake PWA + grading + pricing — *the moat*
2. Shop dashboard + POS w/ Stripe Terminal + liability + disposal (shop-side)
3. (2.5) Super-admin + sales role + commissions + health + evaluation + demo + onboarding
4. Wholesaler adapter + unified search + listings
5. Expo native intake (if PWA bay-signal proves insufficient) + hauler dispatch + marketplace

## Design system (read first)

The positioning depends on **not** looking like generic software or generic AI output.
Hard rules live in `/artifacts/web/src/design/tokens.css`:

- Fonts: **Space Grotesk** (display) + **IBM Plex Sans** (body) + **JetBrains Mono** (data).
  Never Inter/Roboto/Arial/system.
- Palette: deep industrial charcoal base + Heat Amber accent. Avoid the
  purple-gradient-on-white AI cliché entirely.
- Grades (A/B/C/D/FAIL) and prices are hero data — stamped, confident.
- Motion: `framer-motion`. `pageStagger` for page loads; `intakeReveal` for the
  AI intake "wow" moment.
- Every screen consumes primitives from `@/design` — no one-off hardcoded styles.

## Multilingual (cross-cutting)

- No user-facing string is hardcoded. Everything goes through `react-i18next`.
- `en/` and `es/` from day one in `/artifacts/web/src/locales/`. Adding (vi, ko) is just a folder.
- AI-generated content (listings, NL matching) takes a `language` param.
- **Compliance docs use official state bilingual PDFs** (e.g. NC Scrap Tire Certification).
  Custom liability disclosures in Spanish need a legal-fluent-speaker review before launch.

## Security

- See `/Users/trburns/Documents/MOGULCOM-APPS/CLAUDE.md` for the global security protocol.
- No secrets in repo. `.env*` are gitignored. Never paste contents of `.env`.
- Stripe Terminal docs change — verify capabilities/fees/device support live before building
  the in-person layer in Module 10.

## Open items

- **Stripe Terminal**: verify current docs before Module 10.
- **Wholesaler partner**: Tirewire vs TireConnect — adapter-first, decide later.
- **Commission rates**: business decision; engine is configurable.
- **Grading constants**: tread/age thresholds in `services/grading/rules.ts` (Phase 1) — trade secret.
- **Domain/TM**: confirm RUBBERIQ at tmsearch.uspto.gov (classes 009, 042); register `rubberiq.com`.
