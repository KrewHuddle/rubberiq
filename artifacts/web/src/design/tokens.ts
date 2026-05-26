/**
 * Token surface — TS handles to the CSS variables defined in tokens.css.
 * Use these in JS/TS code (Motion variants, dynamic colors) so the design
 * system stays the single source of truth.
 *
 * Font pairing (committed, swap deliberately):
 *   Display: Space Grotesk
 *   Body:    IBM Plex Sans
 *   Mono:    JetBrains Mono
 */

export const tokens = {
  font: {
    display: 'var(--rb-font-display)',
    body: 'var(--rb-font-body)',
    mono: 'var(--rb-font-mono)',
  },
  color: {
    bg: 'var(--rb-bg)',
    bgElev: 'var(--rb-bg-elev)',
    bgSunk: 'var(--rb-bg-sunk)',
    border: 'var(--rb-border)',
    borderStrong: 'var(--rb-border-strong)',
    fg: 'var(--rb-fg)',
    fgMuted: 'var(--rb-fg-muted)',
    fgSubtle: 'var(--rb-fg-subtle)',
    accent: 'var(--rb-accent)',
    accentFg: 'var(--rb-accent-fg)',
    accentHover: 'var(--rb-accent-hover)',
    ring: 'var(--rb-ring)',
  },
  grade: {
    A: 'var(--rb-grade-a)',
    B: 'var(--rb-grade-b)',
    C: 'var(--rb-grade-c)',
    D: 'var(--rb-grade-d)',
    FAIL: 'var(--rb-grade-fail)',
  },
  alert: {
    green: 'var(--rb-alert-green)',
    yellow: 'var(--rb-alert-yellow)',
    red: 'var(--rb-alert-red)',
  },
  radius: {
    sm: 'var(--rb-radius-sm)',
    md: 'var(--rb-radius-md)',
    lg: 'var(--rb-radius-lg)',
    xl: 'var(--rb-radius-xl)',
    stamp: 'var(--rb-radius-stamp)',
  },
  shadow: {
    sm: 'var(--rb-shadow-sm)',
    md: 'var(--rb-shadow-md)',
    lg: 'var(--rb-shadow-lg)',
    stamp: 'var(--rb-shadow-stamp)',
  },
  motion: {
    easeOut: [0.16, 1, 0.3, 1] as const,
    easeSpring: [0.34, 1.56, 0.64, 1] as const,
    durFast: 0.14,
    durBase: 0.24,
    durReveal: 0.52,
  },
} as const;

export type Theme = 'light' | 'dark';

export function setTheme(t: Theme): void {
  document.documentElement.setAttribute('data-theme', t);
  try {
    localStorage.setItem('rb-theme', t);
  } catch {
    /* private mode etc. */
  }
}

export function initTheme(): Theme {
  let t: Theme = 'light';
  try {
    const saved = localStorage.getItem('rb-theme');
    if (saved === 'light' || saved === 'dark') t = saved;
    else if (matchMedia('(prefers-color-scheme: dark)').matches) t = 'dark';
  } catch {
    /* ignore */
  }
  setTheme(t);
  return t;
}
