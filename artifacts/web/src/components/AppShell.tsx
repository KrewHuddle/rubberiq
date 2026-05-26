import { Outlet, NavLink, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import type { Principal } from '../principal.js';
import { setTheme, pageStagger, pageItem, cn } from '../design/index.js';
import { clearPrincipal } from '../principal.js';

type Props = { principal: Principal | null };

export function AppShell({ principal }: Props) {
  const { t, i18n } = useTranslation();

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

  const signOut = () => {
    clearPrincipal();
    location.href = '/sign-in';
  };

  return (
    <div className="min-h-dvh">
      <header className="border-b border-[var(--rb-border)] bg-[var(--rb-bg-elev)]">
        <div className="mx-auto max-w-7xl flex items-center gap-6 px-6 h-14">
          <Link
            to="/"
            className="font-[family-name:var(--rb-font-display)] text-xl font-semibold tracking-tight"
          >
            RubberIQ
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            {principal?.kind === 'user' && (
              <>
                <ShellLink to="/dashboard">{t('nav.dashboard')}</ShellLink>
                <ShellLink to="/intake">{t('nav.intake')}</ShellLink>
                <ShellLink to="/scrap">{t('nav.scrap')}</ShellLink>
              </>
            )}
            {principal?.kind === 'platform' && principal.role === 'super_admin' && (
              <ShellLink to="/admin">{t('nav.admin')}</ShellLink>
            )}
            {principal?.kind === 'platform' &&
              (principal.role === 'sales_agent' || principal.role === 'super_admin') && (
                <ShellLink to="/sales">{t('nav.sales')}</ShellLink>
              )}
          </nav>
          <div className="ml-auto flex items-center gap-2 text-sm">
            <button
              onClick={toggleLang}
              className="px-2 py-1 rounded-[var(--rb-radius-sm)] hover:bg-[var(--rb-bg-sunk)]"
            >
              {t(`languages.${i18n.language === 'es' ? 'en' : 'es'}`)}
            </button>
            <button
              onClick={toggleTheme}
              className="px-2 py-1 rounded-[var(--rb-radius-sm)] hover:bg-[var(--rb-bg-sunk)]"
            >
              ◐
            </button>
            {principal && (
              <button
                onClick={signOut}
                className="px-2 py-1 rounded-[var(--rb-radius-sm)] hover:bg-[var(--rb-bg-sunk)] text-[var(--rb-fg-muted)]"
              >
                {t('nav.signOut')}
              </button>
            )}
          </div>
        </div>
      </header>

      <motion.main
        variants={pageStagger}
        initial="hidden"
        animate="visible"
        className="mx-auto max-w-7xl px-6 py-8 flex-1"
      >
        <motion.div variants={pageItem}>
          <Outlet />
        </motion.div>
      </motion.main>
    </div>
  );
}

function ShellLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'px-3 py-1.5 rounded-[var(--rb-radius-sm)] transition-colors',
          isActive
            ? 'bg-[var(--rb-bg-sunk)] text-[var(--rb-fg)]'
            : 'text-[var(--rb-fg-muted)] hover:text-[var(--rb-fg)] hover:bg-[var(--rb-bg-sunk)]',
        )
      }
    >
      {children}
    </NavLink>
  );
}
