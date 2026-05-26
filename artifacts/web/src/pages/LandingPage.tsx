/**
 * LandingPage — public marketing site at `/` for unauthed visitors.
 *
 * Manifesto-shape (per Hallmark landing audit · v3): copy-led hero, problem
 * field-guide, three-handoff flow, four features, honest beta proof, pricing
 * teaser, final CTA. Uses RubberIQ Phase 0 design tokens (Heat Amber accent,
 * Space Grotesk display, IBM Plex body, JetBrains Mono data) — does NOT
 * introduce a competing aesthetic.
 *
 * NO oil-change copy (per project positioning: used tires only).
 */
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  Badge,
  Button,
  Card,
  GradeStamp,
  PriceTag,
  pageItem,
  pageStagger,
  setTheme,
} from '../design/index.js';

export function LandingPage() {
  const { i18n } = useTranslation('landing');

  const toggleLang = () => {
    const next = i18n.language === 'es' ? 'en' : 'es';
    void i18n.changeLanguage(next);
    try {
      localStorage.setItem('rb-lang', next);
    } catch {
      /* ignore */
    }
  };

  const toggleTheme = () => {
    const cur = document.documentElement.getAttribute('data-theme');
    setTheme(cur === 'dark' ? 'light' : 'dark');
  };

  return (
    <div className="min-h-dvh">
      <LandingHeader onToggleLang={toggleLang} onToggleTheme={toggleTheme} />
      <Hero />
      <BrandBand />
      <Problem />
      <HowItWorks />
      <Features />
      <Proof />
      <PricingTeaser />
      <FinalCta />
      <LandingFooter />
    </div>
  );
}

/* ============================================================
   Reusable kicker
============================================================ */

function Kicker({ children, accent }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-3 font-[family-name:var(--rb-font-mono)] text-xs uppercase tracking-[0.16em] ${
        accent ? 'text-[var(--rb-accent)]' : 'text-[var(--rb-fg-subtle)]'
      }`}
    >
      <span
        aria-hidden
        className={`h-px w-7 ${accent ? 'bg-[var(--rb-accent)]' : 'bg-[var(--rb-border-strong)]'}`}
      />
      {children}
    </span>
  );
}

function Underlined({ children }: { children: React.ReactNode }) {
  return (
    <span className="border-b-2 border-[var(--rb-accent)] pb-[0.04em] inline">
      {children}
    </span>
  );
}

/* ============================================================
   Header
============================================================ */

function LandingHeader({
  onToggleLang,
  onToggleTheme,
}: {
  onToggleLang: () => void;
  onToggleTheme: () => void;
}) {
  const { t, i18n } = useTranslation('landing');
  const { t: tc } = useTranslation('common');
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--rb-border)] bg-[color-mix(in_oklch,var(--rb-bg)_92%,transparent)] backdrop-blur">
      <div className="mx-auto max-w-[1280px] flex items-center gap-4 px-6 lg:px-10 h-16">
        <Link
          to="/"
          className="inline-flex items-center gap-3 font-[family-name:var(--rb-font-display)] text-lg font-bold tracking-tight"
        >
          <span aria-hidden className="h-2.5 w-2.5 rounded-[2px] bg-[var(--rb-accent)]" />
          RubberIQ
        </Link>
        <nav className="hidden md:flex items-center gap-1 text-sm text-[var(--rb-fg-muted)] ml-6">
          <a href="#features" className="px-3 py-1.5 rounded-[var(--rb-radius-sm)] hover:text-[var(--rb-fg)] hover:bg-[var(--rb-bg-sunk)]">
            {t('nav.features')}
          </a>
          <a href="#how" className="px-3 py-1.5 rounded-[var(--rb-radius-sm)] hover:text-[var(--rb-fg)] hover:bg-[var(--rb-bg-sunk)]">
            {t('nav.howItWorks')}
          </a>
          <a href="#pricing" className="px-3 py-1.5 rounded-[var(--rb-radius-sm)] hover:text-[var(--rb-fg)] hover:bg-[var(--rb-bg-sunk)]">
            {t('nav.pricing')}
          </a>
        </nav>
        <div className="ml-auto flex items-center gap-2 text-sm">
          <button
            onClick={onToggleLang}
            className="px-2 py-1 rounded-[var(--rb-radius-sm)] hover:bg-[var(--rb-bg-sunk)] text-[var(--rb-fg-muted)] hover:text-[var(--rb-fg)]"
          >
            {tc(`languages.${i18n.language === 'es' ? 'en' : 'es'}`)}
          </button>
          <button
            onClick={onToggleTheme}
            aria-label="Toggle theme"
            className="px-2 py-1 rounded-[var(--rb-radius-sm)] hover:bg-[var(--rb-bg-sunk)] text-[var(--rb-fg-muted)] hover:text-[var(--rb-fg)]"
          >
            ◐
          </button>
          <Link
            to="/sign-in"
            className="hidden sm:inline-block px-3 py-1.5 rounded-[var(--rb-radius-sm)] text-[var(--rb-fg-muted)] hover:text-[var(--rb-fg)]"
          >
            {tc('nav.signIn')}
          </Link>
          <Link to="/sign-in">
            <Button tone="primary" size="sm">
              {t('hero.ctaPrimary')}
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}

/* ============================================================
   Hero — copy left, intake demo right
============================================================ */

function Hero() {
  const { t } = useTranslation('landing');
  return (
    <section className="relative border-b border-[var(--rb-border)]">
      <motion.div
        variants={pageStagger}
        initial="hidden"
        animate="visible"
        className="mx-auto max-w-[1280px] px-6 lg:px-10 pt-16 pb-20 lg:pt-24 lg:pb-24"
      >
        <div className="grid lg:grid-cols-[1.15fr_1fr] gap-12 lg:gap-10 items-center">
          <motion.div variants={pageItem}>
            <div className="mb-6">
              <Kicker>{t('hero.eyebrow')}</Kicker>
            </div>

            <h1 className="font-[family-name:var(--rb-font-display)] font-bold leading-[0.96] tracking-[-0.035em] text-[clamp(2.75rem,8vw,5.5rem)] max-w-[14ch] [text-wrap:balance]">
              {t('hero.titlePre')}{' '}
              <span className="text-[var(--rb-accent)]">{t('hero.titleAccent')}</span>
              {t('hero.titlePost')}
            </h1>

            <p className="mt-6 max-w-[58ch] text-lg text-[var(--rb-fg-muted)] leading-relaxed">
              {t('hero.subtitle')}
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/sign-in">
                <Button tone="primary" size="lg">{t('hero.ctaPrimary')}</Button>
              </Link>
              <a href="#how">
                <Button tone="secondary" size="lg">{t('hero.ctaSecondary')}</Button>
              </a>
            </div>

            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-3 font-[family-name:var(--rb-font-mono)] text-xs uppercase tracking-[0.1em] text-[var(--rb-fg-subtle)]">
              {(t('hero.trust', { returnObjects: true }) as string[]).map((s) => (
                <li key={s} className="inline-flex items-center gap-2">
                  <span aria-hidden className="h-px w-4 bg-[var(--rb-border-strong)]" />
                  {s}
                </li>
              ))}
            </ul>
          </motion.div>

          <motion.div variants={pageItem}>
            <HeroDemo />
          </motion.div>
        </div>

        {/* Payoff bar — full width below */}
        <div className="mt-16 pt-12 border-t border-[var(--rb-border)] grid gap-6 sm:grid-cols-3">
          <PayoffStep
            num="01"
            kind="text"
            value={t('hero.payoff.snap.label')}
            sub={t('hero.payoff.snap.sub')}
          />
          <PayoffStep num="02" kind="grade" sub={t('hero.payoff.grade.sub')} />
          <PayoffStep num="03" kind="price" cents={6500} sub={t('hero.payoff.price.sub')} />
        </div>
      </motion.div>
    </section>
  );
}

function PayoffStep({
  num,
  kind,
  value,
  cents,
  sub,
}: {
  num: string;
  kind: 'text' | 'grade' | 'price';
  value?: string;
  cents?: number;
  sub: string;
}) {
  return (
    <div className="grid grid-cols-[32px_minmax(0,1fr)] gap-4 items-baseline rounded-[var(--rb-radius-md)] border border-[var(--rb-border)] bg-[var(--rb-bg-elev)] p-5">
      <div className="font-[family-name:var(--rb-font-mono)] text-xs tracking-[0.12em] uppercase text-[var(--rb-fg-subtle)] pt-1">
        {num}
      </div>
      <div className="min-w-0">
        {kind === 'text' && (
          <div className="font-[family-name:var(--rb-font-display)] text-2xl font-bold leading-none tracking-tight">
            {value}
          </div>
        )}
        {kind === 'grade' && (
          <div className="flex items-center gap-3">
            <GradeStamp grade="B" size="md" />
            <span className="font-[family-name:var(--rb-font-display)] text-2xl font-bold text-[var(--rb-fg-muted)]">
              Grade
            </span>
          </div>
        )}
        {kind === 'price' && (
          <PriceTag cents={cents ?? 0} className="text-3xl" />
        )}
        <div className="mt-2 text-sm text-[var(--rb-fg-subtle)] font-normal normal-case tracking-normal leading-snug">
          {sub}
        </div>
      </div>
    </div>
  );
}

function HeroDemo() {
  return (
    <figure className="relative aspect-[5/4] min-w-0 rounded-[var(--rb-radius-lg)] border border-[var(--rb-border)] bg-[var(--rb-bg-sunk)] overflow-hidden">
      <svg viewBox="0 0 640 440" preserveAspectRatio="xMidYMid meet" className="block w-full h-full">
        {/* tire body */}
        <circle cx="320" cy="220" r="190" fill="oklch(28% 0.012 60)" />
        <circle cx="320" cy="220" r="190" fill="oklch(20% 0.012 60)" />
        <circle cx="320" cy="220" r="150" fill="var(--rb-bg-sunk)" />

        {/* ticks */}
        <g stroke="var(--rb-fg-subtle)" strokeWidth="2" opacity="0.7">
          <line x1="320" y1="30" x2="320" y2="70" />
          <line x1="450" y1="55" x2="438" y2="92" />
          <line x1="528" y1="125" x2="500" y2="142" />
          <line x1="510" y1="220" x2="475" y2="220" />
          <line x1="528" y1="315" x2="500" y2="298" />
          <line x1="450" y1="385" x2="438" y2="348" />
          <line x1="320" y1="410" x2="320" y2="370" />
          <line x1="190" y1="385" x2="202" y2="348" />
          <line x1="112" y1="315" x2="140" y2="298" />
          <line x1="130" y1="220" x2="165" y2="220" />
          <line x1="112" y1="125" x2="140" y2="142" />
          <line x1="190" y1="55" x2="202" y2="92" />
        </g>

        {/* spokes */}
        <circle cx="320" cy="220" r="90" fill="none" stroke="var(--rb-fg-subtle)" strokeWidth="1.5" opacity="0.7" />
        <g stroke="var(--rb-fg-subtle)" strokeWidth="2" opacity="0.85">
          <line x1="320" y1="135" x2="320" y2="305" />
          <line x1="235" y1="220" x2="405" y2="220" />
          <line x1="259" y1="159" x2="381" y2="281" />
          <line x1="259" y1="281" x2="381" y2="159" />
        </g>
        <circle cx="320" cy="220" r="20" fill="var(--rb-bg-elev)" stroke="var(--rb-fg-subtle)" strokeWidth="1.5" />

        {/* callouts */}
        {([
          { lx1: 320, ly1: 30, lx2: 320, ly2: 14, lx3: 500, ly3: 14, anchor: 'end' as const, tx: 500, ty: 12, label: 'SIZE', unit: '225 / 65 R17', ux: 500, uy: 28, dx: 320, dy: 30 },
          { lx1: 510, ly1: 220, lx2: 615, ly2: 220, lx3: 615, ly3: 195, anchor: 'end' as const, tx: 612, ty: 185, label: 'DOT', unit: '2423', ux: 612, uy: 212, dx: 510, dy: 220 },
          { lx1: 130, ly1: 220, lx2: 25, ly2: 220, lx3: 25, ly3: 195, anchor: 'start' as const, tx: 28, ty: 185, label: 'TREAD', unit: '7 / 32"', ux: 28, uy: 212, dx: 130, dy: 220 },
          { lx1: 438, ly1: 348, lx2: 510, ly2: 404, lx3: 615, ly3: 404, anchor: 'end' as const, tx: 612, ty: 397, label: 'AGE', unit: '18 MO', ux: 612, uy: 424, dx: 438, dy: 348 },
          { lx1: 202, ly1: 348, lx2: 130, ly2: 404, lx3: 25, ly3: 404, anchor: 'start' as const, tx: 28, ty: 397, label: 'FLAGS', unit: '— NONE', ux: 28, uy: 424, dx: 202, dy: 348 },
        ]).map((c, i) => (
          <g key={i}>
            <line x1={c.lx1} y1={c.ly1} x2={c.lx2} y2={c.ly2} stroke="var(--rb-fg-subtle)" strokeWidth="1" />
            <line x1={c.lx2} y1={c.ly2} x2={c.lx3} y2={c.ly3} stroke="var(--rb-fg-subtle)" strokeWidth="1" />
            <circle cx={c.dx} cy={c.dy} r="4" fill="var(--rb-accent)" />
            <text
              x={c.tx}
              y={c.ty}
              textAnchor={c.anchor}
              fontSize="11"
              letterSpacing="0.08em"
              fill="var(--rb-fg-muted)"
              fontFamily="var(--rb-font-mono)"
              style={{ textTransform: 'uppercase' }}
            >
              {c.label}
            </text>
            <text
              x={c.ux}
              y={c.uy}
              textAnchor={c.anchor}
              fontSize="11"
              letterSpacing="0.08em"
              fill="var(--rb-accent)"
              fontFamily="var(--rb-font-mono)"
              fontWeight="500"
            >
              {c.unit}
            </text>
          </g>
        ))}
      </svg>
    </figure>
  );
}

/* ============================================================
   Brand band — calm scrolling
============================================================ */

function BrandBand() {
  const { t } = useTranslation('landing');
  const items = t('brandband', { returnObjects: true }) as string[];
  const doubled = [...items, ...items];
  return (
    <div className="border-b border-[var(--rb-border)] bg-[var(--rb-bg-sunk)] py-5 overflow-hidden" aria-hidden>
      <div
        className="flex w-max gap-10 font-[family-name:var(--rb-font-mono)] text-xs uppercase tracking-[0.18em] text-[var(--rb-fg-muted)] whitespace-nowrap"
        style={{ animation: 'rb-roll 50s linear infinite' }}
      >
        {doubled.map((s, i) => (
          <span key={i} className="inline-flex items-center gap-4">
            {s}
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[var(--rb-accent)]" />
          </span>
        ))}
      </div>
      <style>{`
        @keyframes rb-roll {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        @media (prefers-reduced-motion: reduce) {
          [aria-hidden] > div { animation: none !important; }
        }
      `}</style>
    </div>
  );
}

/* ============================================================
   Section head — 2-col: title left, poster glyph right
============================================================ */

function SectionHead({
  num,
  kicker,
  title,
  deck,
  posterLabel,
  posterGlyph,
}: {
  num: string;
  kicker: string;
  title: React.ReactNode;
  deck?: string;
  posterLabel: string;
  posterGlyph: React.ReactNode;
}) {
  return (
    <header className="mb-12 lg:mb-16 grid grid-cols-1 md:grid-cols-[minmax(0,2fr)_minmax(0,1.1fr)] gap-6 md:gap-12 items-end">
      <div className="max-w-[40ch] grid gap-4">
        <Kicker>
          § {num} · {kicker}
        </Kicker>
        <h2 className="font-[family-name:var(--rb-font-display)] font-bold tracking-[-0.035em] leading-none text-[clamp(2.25rem,5vw,3.5rem)]">
          {title}
        </h2>
        {deck && <p className="text-lg text-[var(--rb-fg-muted)] leading-snug">{deck}</p>}
      </div>
      <div className="hidden md:block text-right font-[family-name:var(--rb-font-display)] font-bold tracking-[-0.06em] leading-[0.82] text-[clamp(3.5rem,9vw,6.5rem)] text-[var(--rb-fg-muted)] opacity-40 tabular-nums select-none">
        <div className="font-[family-name:var(--rb-font-mono)] font-medium text-xs uppercase tracking-[0.18em] text-[var(--rb-fg-subtle)] mb-3 opacity-100">
          {posterLabel}
        </div>
        {posterGlyph}
      </div>
    </header>
  );
}

/* ============================================================
   § 01 Problem
============================================================ */

function Problem() {
  const { t } = useTranslation('landing');
  const entries = ['intake', 'pricing', 'disposal'] as const;
  return (
    <section id="problem" className="border-b border-[var(--rb-border)] py-16 lg:py-24">
      <div className="mx-auto max-w-[1280px] px-6 lg:px-10">
        <SectionHead
          num="01"
          kicker={t('problem.kicker')}
          title={
            <>
              {t('problem.titlePre')}{' '}
              <Underlined>{t('problem.titleAccent')}</Underlined>
              {t('problem.titlePost')}
            </>
          }
          posterLabel={t('problem.posterLabel')}
          posterGlyph={
            <>
              01<span className="text-[var(--rb-accent)]">.</span>
            </>
          }
        />

        <ol className="border-t border-[var(--rb-border)]">
          {entries.map((key, i) => (
            <li
              key={key}
              className="grid grid-cols-1 md:grid-cols-[minmax(120px,0.5fr)_minmax(0,3fr)_minmax(0,2fr)] gap-4 md:gap-10 py-8 md:py-10 border-b border-[var(--rb-border)]"
            >
              <div className="font-[family-name:var(--rb-font-display)] font-bold tracking-tight leading-[0.9] text-[clamp(1.75rem,3.5vw,2.5rem)] text-[var(--rb-fg-muted)] opacity-50 tabular-nums">
                {String(i + 1).padStart(2, '0')}
              </div>
              <h3 className="font-[family-name:var(--rb-font-display)] font-bold leading-tight tracking-[-0.025em] text-[clamp(1.375rem,2.4vw,1.75rem)]">
                {t(`problem.entries.${key}.head`)}
              </h3>
              <p className="text-[var(--rb-fg-muted)] max-w-[44ch] leading-relaxed">
                {t(`problem.entries.${key}.body`)}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ============================================================
   § 02 How it works
============================================================ */

function HowItWorks() {
  const { t } = useTranslation('landing');
  const steps = ['intake', 'intelligence', 'action'] as const;
  return (
    <section id="how" className="border-b border-[var(--rb-border)] py-16 lg:py-24 bg-[var(--rb-bg-sunk)]">
      <div className="mx-auto max-w-[1280px] px-6 lg:px-10">
        <SectionHead
          num="02"
          kicker={t('how.kicker')}
          title={
            <>
              <Underlined>{t('how.titleAccent')}</Underlined>
              {t('how.titlePost')}
            </>
          }
          posterLabel={t('how.posterLabel')}
          posterGlyph={
            <>
              02<span className="text-[var(--rb-accent)]">.</span>
            </>
          }
        />

        <ol className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {steps.map((key, i) => (
            <li key={key} className="relative">
              <Card className="h-full">
                <div className="absolute top-5 right-6 font-[family-name:var(--rb-font-mono)] text-xs tracking-[0.16em] uppercase text-[var(--rb-fg-subtle)]">
                  Step 0{i + 1}
                </div>
                <div className="mb-6 grid place-items-center w-11 h-11 rounded-[var(--rb-radius-sm)] border border-[var(--rb-border-strong)] bg-[var(--rb-bg-sunk)] text-[var(--rb-fg)]">
                  <FlowIcon name={key} />
                </div>
                <h3 className="font-[family-name:var(--rb-font-display)] font-bold leading-tight tracking-[-0.025em] text-2xl mb-3">
                  {t(`how.steps.${key}.title`)}
                </h3>
                <p className="text-sm text-[var(--rb-fg-muted)] leading-relaxed mb-6">
                  {t(`how.steps.${key}.body`)}
                </p>
                <dl className="grid grid-cols-[36px_minmax(0,1fr)] gap-x-3 gap-y-2 pt-4 border-t border-[var(--rb-border)] font-[family-name:var(--rb-font-mono)] text-xs">
                  <dt className="text-[var(--rb-fg-subtle)] uppercase tracking-[0.1em] font-medium">In</dt>
                  <dd className="text-[var(--rb-fg-muted)] m-0">{t(`how.steps.${key}.in`)}</dd>
                  <dt className="text-[var(--rb-fg-subtle)] uppercase tracking-[0.1em] font-medium">By</dt>
                  <dd className="text-[var(--rb-fg-muted)] m-0">{t(`how.steps.${key}.by`)}</dd>
                </dl>
              </Card>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function FlowIcon({ name }: { name: 'intake' | 'intelligence' | 'action' }) {
  const props = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  switch (name) {
    case 'intake':
      return (
        <svg viewBox="0 0 24 24" width={22} height={22} {...props}>
          <path d="M14.5 4h-5L8 6H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-3z" />
          <circle cx="12" cy="13" r="4" />
        </svg>
      );
    case 'intelligence':
      return (
        <svg viewBox="0 0 24 24" width={22} height={22} {...props}>
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      );
    case 'action':
      return (
        <svg viewBox="0 0 24 24" width={22} height={22} {...props}>
          <polyline points="9 11 12 14 22 4" />
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </svg>
      );
  }
}

/* ============================================================
   § 03 Features
============================================================ */

function Features() {
  const { t } = useTranslation('landing');
  const items = ['intake', 'wholesaler', 'history', 'disposal'] as const;
  return (
    <section id="features" className="border-b border-[var(--rb-border)] py-16 lg:py-24">
      <div className="mx-auto max-w-[1280px] px-6 lg:px-10">
        <SectionHead
          num="03"
          kicker={t('features.kicker')}
          title={
            <>
              {t('features.titlePre')}{' '}
              <Underlined>{t('features.titleAccent')}</Underlined>
              {t('features.titlePost')}
            </>
          }
          deck={t('features.deck')}
          posterLabel={t('features.posterLabel')}
          posterGlyph={
            <>
              04<span className="text-[var(--rb-accent)]">.</span>
            </>
          }
        />

        <div className="border-t-2 border-[var(--rb-border-strong)]">
          {items.map((key, i) => (
            <FeatureRow key={key} index={i + 1} tkey={key} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FeatureRow({ index, tkey }: { index: number; tkey: string }) {
  const { t } = useTranslation('landing');
  const specs = t(`features.items.${tkey}.spec`, { returnObjects: true }) as Record<string, string>;
  const aside = t(`features.items.${tkey}.aside`, { returnObjects: true }) as Array<{
    k: string;
    v: string;
    accent?: boolean;
  }>;

  return (
    <article className="grid grid-cols-1 lg:grid-cols-[140px_minmax(0,5fr)_minmax(0,4fr)] gap-6 lg:gap-10 py-10 lg:py-12 border-b border-[var(--rb-border)] items-start">
      <div className="font-[family-name:var(--rb-font-mono)] text-xs uppercase tracking-[0.14em] text-[var(--rb-fg-subtle)]">
        <b className="block text-[var(--rb-accent)] font-semibold mb-2">F-0{index}</b>
        {t(`features.items.${tkey}.tag`)}
      </div>
      <div className="min-w-0">
        <h3 className="font-[family-name:var(--rb-font-display)] font-bold leading-none tracking-[-0.03em] text-[clamp(1.75rem,3vw,2.5rem)] max-w-[24ch]">
          {t(`features.items.${tkey}.titlePre`)}{' '}
          <Underlined>{t(`features.items.${tkey}.titleAccent`)}</Underlined>
          {t(`features.items.${tkey}.titlePost`)}
        </h3>
        <p className="mt-5 max-w-[52ch] text-[var(--rb-fg-muted)] leading-relaxed">
          {t(`features.items.${tkey}.body`)}
        </p>
        <dl className="mt-6 border-t border-[var(--rb-border)]">
          {Object.entries(specs).map(([k, v]) => (
            <div
              key={k}
              className="grid grid-cols-[140px_minmax(0,1fr)] gap-3 py-3 border-b border-[var(--rb-border)] text-sm"
            >
              <dt className="font-[family-name:var(--rb-font-mono)] text-xs uppercase tracking-[0.08em] text-[var(--rb-fg-subtle)] pt-1 font-medium">
                {k}
              </dt>
              <dd className="m-0 text-[var(--rb-fg)]">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
      <aside className="min-w-0 rounded-[var(--rb-radius-md)] border border-[var(--rb-border)] bg-[var(--rb-bg-elev)] p-6">
        <span className="block font-[family-name:var(--rb-font-mono)] text-xs uppercase tracking-[0.14em] text-[var(--rb-fg-subtle)] font-medium mb-4 pb-3 border-b border-[var(--rb-border)]">
          {t(`features.items.${tkey}.asideLabel`)}
        </span>
        {aside.map((row, i) => (
          <div
            key={`${row.k}-${i}`}
            className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 items-baseline py-2 text-sm first:pt-0 last:pb-0 [&:not(:first-child)]:border-t [&:not(:first-child)]:border-[var(--rb-border)]"
          >
            <span className="font-[family-name:var(--rb-font-mono)] text-xs uppercase tracking-[0.06em] text-[var(--rb-fg-subtle)]">
              {row.k}
            </span>
            <span
              className={`tabular-nums min-w-0 ${
                row.accent
                  ? 'text-[var(--rb-accent)] font-[family-name:var(--rb-font-mono)] font-semibold'
                  : 'text-[var(--rb-fg)]'
              }`}
            >
              {row.v}
            </span>
          </div>
        ))}
      </aside>
    </article>
  );
}

/* ============================================================
   § 04 Proof — honest placeholder
============================================================ */

function Proof() {
  const { t } = useTranslation('landing');
  return (
    <section id="proof" className="border-b border-[var(--rb-border)] py-16 lg:py-24 bg-[var(--rb-bg-sunk)]">
      <div className="mx-auto max-w-[1280px] px-6 lg:px-10">
        <SectionHead
          num="04"
          kicker={t('proof.kicker')}
          title={
            <>
              {t('proof.titlePre')}{' '}
              <Underlined>{t('proof.titleAccent')}</Underlined>
              {t('proof.titlePost')}
            </>
          }
          deck={t('proof.deck')}
          posterLabel={t('proof.posterLabel')}
          posterGlyph={
            <>
              06<span className="text-[var(--rb-accent)]">.</span>
            </>
          }
        />

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-10 lg:gap-12 items-start">
          <figure className="relative rounded-[var(--rb-radius-md)] border-2 border-[var(--rb-border-strong)] bg-[var(--rb-bg-elev)] p-8 lg:p-10">
            <Badge tone="yellow" className="absolute -top-3 left-6 bg-[var(--rb-bg-sunk)]">
              {t('proof.placeholder')}
            </Badge>
            <blockquote className="font-[family-name:var(--rb-font-display)] font-semibold italic text-[clamp(1.125rem,2vw,1.375rem)] leading-[1.3] tracking-[-0.02em] text-[var(--rb-fg-muted)] max-w-[36ch] m-0">
              {t('proof.quoteBody')}
            </blockquote>
            <figcaption className="mt-8 pt-4 border-t border-[var(--rb-border)] grid grid-cols-[auto_minmax(0,1fr)] gap-3 text-sm text-[var(--rb-fg-subtle)]">
              <span aria-hidden>—</span>
              <span>
                <b className="block text-[var(--rb-fg)] font-semibold">{t('proof.attribName')}</b>
                {t('proof.attribDetail')}
              </span>
            </figcaption>
          </figure>

          <div className="min-w-0">
            <p className="inline-flex items-center gap-2 font-[family-name:var(--rb-font-mono)] text-xs uppercase tracking-[0.14em] text-[var(--rb-alert-yellow)] font-medium">
              <span aria-hidden className="h-px w-4 bg-[var(--rb-alert-yellow)]" />
              {t('proof.logosNote')}
            </p>
            <p className="mt-4 font-[family-name:var(--rb-font-mono)] text-xs uppercase tracking-[0.14em] text-[var(--rb-fg-subtle)]">
              {t('proof.logosLabel')}
            </p>
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2" role="list">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  role="listitem"
                  className="grid place-items-center border border-dashed border-[var(--rb-border-strong)] rounded-[var(--rb-radius-xs)] aspect-[5/2] font-[family-name:var(--rb-font-mono)] text-[0.65rem] uppercase tracking-[0.14em] text-[var(--rb-fg-subtle)] text-center p-2 min-w-0"
                >
                  <span>
                    <b className="block text-[var(--rb-fg-muted)] font-medium">
                      Beta · 0{i + 1}
                    </b>
                    {t('proof.slot')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   § 05 Pricing teaser
============================================================ */

function PricingTeaser() {
  const { t } = useTranslation('landing');
  return (
    <section id="pricing" className="border-b border-[var(--rb-border)] py-16 lg:py-24">
      <div className="mx-auto max-w-[1280px] px-6 lg:px-10">
        <SectionHead
          num="05"
          kicker={t('pricing.kicker')}
          title={
            <>
              {t('pricing.titlePre')}{' '}
              <Underlined>{t('pricing.titleAccent')}</Underlined>
              {t('pricing.titlePost')}
            </>
          }
          posterLabel={t('pricing.posterLabel')}
          posterGlyph={
            <>
              <span className="text-[var(--rb-accent)]">$</span>149
            </>
          }
        />

        <div className="rounded-[var(--rb-radius-md)] border-2 border-[var(--rb-border-strong)] bg-[var(--rb-bg-elev)] p-8 lg:p-10 grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto] gap-8 md:gap-12 items-center">
          <div>
            <div className="flex items-baseline gap-3 flex-wrap mb-4">
              <div className="font-[family-name:var(--rb-font-display)] font-bold leading-[0.95] tracking-[-0.045em] tabular-nums text-[clamp(3.25rem,7vw,5rem)]">
                <span className="text-[var(--rb-accent)] font-semibold text-[0.6em] align-top">
                  $
                </span>
                149
              </div>
              <div className="font-[family-name:var(--rb-font-mono)] text-xs uppercase tracking-[0.1em] text-[var(--rb-fg-subtle)] font-medium">
                {t('pricing.cadence')}
              </div>
            </div>
            <p className="text-base text-[var(--rb-fg-muted)] max-w-[54ch] leading-relaxed">
              {t('pricing.body')}
            </p>
            <p className="mt-3 font-[family-name:var(--rb-font-mono)] text-xs uppercase tracking-[0.08em] text-[var(--rb-fg-subtle)] font-medium">
              {t('pricing.fine')}
            </p>
          </div>
          <div className="flex flex-col gap-3 min-w-0">
            <Link to="/sign-in">
              <Button tone="primary" size="lg" className="w-full">
                {t('hero.ctaPrimary')}
              </Button>
            </Link>
            <Link to="/sign-in">
              <Button tone="secondary" size="lg" className="w-full">
                {t('hero.ctaSecondary')}
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   § 06 Final CTA
============================================================ */

function FinalCta() {
  const { t } = useTranslation('landing');
  return (
    <section
      id="demo"
      className="py-16 lg:py-24 bg-[var(--rb-accent)] text-[var(--rb-accent-fg)]"
    >
      <div className="mx-auto max-w-[1280px] px-6 lg:px-10 grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto] gap-8 md:gap-12 items-end">
        <div>
          <span className="inline-flex items-center gap-3 font-[family-name:var(--rb-font-mono)] text-xs uppercase tracking-[0.16em] font-semibold mb-6">
            <span aria-hidden className="h-px w-7 bg-current" />
            {t('cta.kicker')}
          </span>
          <h2 className="font-[family-name:var(--rb-font-display)] font-bold leading-[0.96] tracking-[-0.04em] text-[clamp(2.75rem,7vw,5rem)] max-w-[14ch] [text-wrap:balance]">
            {t('cta.title')}
          </h2>
          <p className="mt-6 text-lg max-w-[52ch] opacity-85">{t('cta.body')}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <a href="mailto:demo@rubberiq.com?subject=Book%20a%20demo">
            <Button
              tone="primary"
              size="lg"
              className="!bg-[var(--rb-accent-fg)] !text-[var(--rb-accent)] hover:!bg-[var(--rb-bg)]"
            >
              {t('hero.ctaPrimary')}
            </Button>
          </a>
          <Link to="/sign-in">
            <Button
              tone="secondary"
              size="lg"
              className="!bg-transparent !text-[var(--rb-accent-fg)] !border-[var(--rb-accent-fg)] hover:!bg-[var(--rb-accent-fg)] hover:!text-[var(--rb-accent)]"
            >
              {t('hero.ctaSecondary')}
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   Footer
============================================================ */

function LandingFooter() {
  const { t } = useTranslation('landing');
  return (
    <footer className="bg-[var(--rb-bg)] pt-12 lg:pt-16 pb-8">
      <div className="mx-auto max-w-[1280px] px-6 lg:px-10">
        <p className="font-[family-name:var(--rb-font-display)] font-bold leading-tight tracking-[-0.03em] text-[clamp(1.75rem,4vw,2.5rem)] max-w-[22ch] m-0">
          {t('footer.statementPre')}{' '}
          <Underlined>{t('footer.statementAccent')}</Underlined>
          {t('footer.statementPost')}
        </p>
        <div className="mt-10 pt-6 border-t border-[var(--rb-border)] grid gap-6 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)] md:gap-8 md:items-end text-sm text-[var(--rb-fg-subtle)]">
          <div>
            <b className="block text-[var(--rb-fg)] font-semibold mb-0.5">{t('footer.brand')}</b>
            {t('footer.brandSub')}
          </div>
          <div>
            <b className="block text-[var(--rb-fg)] font-semibold mb-0.5">{t('footer.talk')}</b>
            <a href="mailto:hello@rubberiq.com" className="underline underline-offset-4 decoration-[var(--rb-border-strong)] hover:decoration-[var(--rb-accent)] hover:text-[var(--rb-accent)]">
              hello@rubberiq.com
            </a>
            <br />
            <a href="mailto:demo@rubberiq.com" className="underline underline-offset-4 decoration-[var(--rb-border-strong)] hover:decoration-[var(--rb-accent)] hover:text-[var(--rb-accent)]">
              demo@rubberiq.com
            </a>
          </div>
          <div className="font-[family-name:var(--rb-font-mono)] text-xs uppercase tracking-[0.12em] text-[var(--rb-fg-subtle)]">
            {t('footer.copyright')}
          </div>
        </div>
      </div>
    </footer>
  );
}
