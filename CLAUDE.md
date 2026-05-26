# RubberIQ — Project Context (CLAUDE.md)

## What this is
RubberIQ is an AI-first SaaS operations platform for **used tire shops** (used tires only — this is NOT an oil-change/quick-lube product; that market was evaluated and deliberately excluded as saturated). Built under Guru Boxz Technologies LLC. Location: `/Users/trburns/Documents/MOGULCOM-APPS/RUBBERIQ/`.

## The core thesis
Incumbent used-tire software (Used Tire Shop, Tire Shop Control, Tire Inventory Solutions) is functional but dated, built around manual data entry and single-shop workflows. RubberIQ wins on three things they can't quickly copy:

1. **AI intake** — a worker photographs a tire's sidewall; a vision model extracts brand, size, load index, speed rating, and DOT date code in seconds instead of manual keying.
2. **Deterministic AI grading + pricing** — tread depth + DOT age + brand tier produce a transparent, reproducible A/B/C/D grade and a fair-market price benchmarked against live new-tire wholesale pricing. (The grading constants are a trade secret — keep tunable and private.)
3. **Hybrid inventory** — the shop's own used stock PLUS a plug-in new-tire wholesaler catalog (Tirewire or TireConnect aggregator API), so one search answers "what can I sell this customer right now."

## What it includes
- Used-tire inventory with lifecycle (intake → graded → in_stock → sold/scrapped → hauled)
- AI photo intake (built as a PWA in Phase 1; Expo native app deferred)
- Deterministic grading engine (liability backbone — tread ≤2/32 or age >72mo auto-routes to scrap, never sold)
- Pricing engine benchmarked to wholesale
- New-tire wholesaler integration via a swappable adapter interface
- Customer/vehicle matching (VIN/plate/YMM → OE size; natural-language, multilingual)
- AI listing generation (multilingual)
- POS + invoicing with Stripe Terminal tap-to-pay (Connect via @guruboxz/payments)
- Liability/compliance docs (tread+DOT documentation per sale)
- **Module 11/12 — Disposal & scrap compliance + DISPOSAL SERVICE (both core, not deferred):** Shop-facing compliance — scrap lifecycle, NC Scrap Tire Certification Form (Parts I/II, 3-yr retention, $15k-penalty awareness), PA waste-tire transporter + Act 90 + manifest, destination-facility permit capture. PLUS the disposal SERVICE / hauler dispatch — pickup queue (platform generates the demand signal from scrap-on-hand), route batching by truck capacity ("tires until full", reuses Waxhaw Eats zone pattern), fee reconciliation (collected vs haul cost → margin), verified NC DEQ/PA DEP hauler+facility directories, cross-shop scrap-volume map. This is the SECOND REVENUE STREAM and a stickiness driver. The dispatch code is built in core (Phase 2.5); switching it ON operationally requires the NC hauler registration + permitted facility (operational gate, not a build gate).
- **Three-tier backends:** super-admin (platform owner), shop dashboard (per-shop, self-serve staff management), in-shop POS.
- **Go-to-market engine:** scoped sales-agent role, configurable commission engine (default life-of-account residual + upseller-attributed upsells), account health scores, churn + upsell alerts, retention-weighted salesperson evaluation + goals, demo/sandbox mode, fully electronic onboarding.

## Stack
Node.js + Express 5, TypeScript strict, PostgreSQL on the `guru-boxz-db` DigitalOcean cluster (database `rubberiq`), Drizzle ORM, React/Vite (one role-gated app), Anthropic SDK (vision + multilingual content), Stripe Connect + Stripe Terminal via `@guruboxz/payments`, react-i18next (en + es from day one), Sentry (org `guru-boxz`, separate `dist/instrument.mjs` ESM entry), DigitalOcean App Platform, GitHub under `guruboxz` org.

## Design rules (non-negotiable — this is the wedge vs dated incumbents)
- Must NOT look like generic software or generic AI output.
- Aesthetic: industrial/utilitarian precision meets modern fintech clarity (Linear/Stripe-grade confidence with a shop-floor edge). Light + dark.
- NEVER use Inter, Roboto, Arial, or system fonts as the brand face. Pair a distinctive display font with a clean body font.
- NO purple-gradient-on-white AI cliché. Committed palette via CSS tokens: industrial dark base, one confident accent, semantic grade colors (A=green, B=blue, C=amber, D=orange) and health colors (green/yellow/red).
- Token-based design system; every screen consumes shared primitives (Button, Card, Badge, GradeStamp, PriceTag, DataTable, StatTile). No one-off hardcoded styles.
- Motion library for React. The signature moment is the **AI intake reveal**: a photo resolving into a graded, priced tire — this is the demo "wow" and must be polished.

## Multilingual
No user-facing string hardcoded — all via react-i18next. Language preference stored per shop, per user, and per customer. AI-generating services take a `language` param. Use official state bilingual compliance forms (NC publishes EN+ES); do not self-translate legal documents.

## Build phases
0. Repo + stack + schema + auth/roles + design system + i18n scaffold (foundational — first).
1. The moat: AI intake PWA + grading + pricing.
2. Sellable v1: shop dashboard + self-serve users + POS/Terminal + liability + disposal compliance (shop-side).
2.5. Go-to-market + disposal service: super-admin + sales role + commissions + health/alerts + evaluation/goals + demo mode + electronic onboarding + disposal-service hauler dispatch (12b–c; code ships here, operational switch-on needs NC hauler registration + permitted facility).
3. Wholesaler adapter + unified search + listings (when API credentials land).
4. Expo native intake app (if bay-signal demands), cross-shop marketplace.

## Build style
TR is a software engineer who architects, directs, reviews, and ships AI-assisted builds. Prefer complete, copy-paste-ready prompts with exact file paths, schema, route definitions, and UI specs. Minimal back-and-forth.
