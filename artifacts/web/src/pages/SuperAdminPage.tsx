/**
 * Super-admin shell — tabbed nav for platform surfaces.
 * Outer route is `/admin/*`; this component owns the inner Routes.
 */
import { NavLink, Route, Routes } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '../design/index.js';
import { OverviewPage } from './admin/OverviewPage.js';
import { ShopsPage } from './admin/ShopsPage.js';
import { AgentsPage } from './admin/AgentsPage.js';
import { CommissionPlansPage } from './admin/CommissionPlansPage.js';
import { CommissionsPage } from './admin/CommissionsPage.js';
import { HealthPage } from './admin/HealthPage.js';
import { AlertsPage } from './admin/AlertsPage.js';

export function SuperAdminPage() {
  const { t } = useTranslation('admin');

  return (
    <div className="space-y-6">
      <header className="flex items-baseline justify-between gap-4 flex-wrap">
        <h1 className="font-[family-name:var(--rb-font-display)] text-4xl font-semibold tracking-tight">
          {t('overview.title')}
        </h1>
        <div className="text-sm text-[var(--rb-fg-muted)] rb-mono">{t('overview.subtitle')}</div>
      </header>

      <nav className="flex flex-wrap gap-1 border-b border-[var(--rb-border)] -mb-px">
        <TabLink to="/admin" end>
          {t('tabs.overview')}
        </TabLink>
        <TabLink to="/admin/shops">{t('tabs.shops')}</TabLink>
        <TabLink to="/admin/agents">{t('tabs.agents')}</TabLink>
        <TabLink to="/admin/plans">{t('tabs.plans')}</TabLink>
        <TabLink to="/admin/commissions">{t('tabs.commissions')}</TabLink>
        <TabLink to="/admin/health">{t('tabs.health')}</TabLink>
        <TabLink to="/admin/alerts">{t('tabs.alerts')}</TabLink>
      </nav>

      <Routes>
        <Route index element={<OverviewPage />} />
        <Route path="shops" element={<ShopsPage />} />
        <Route path="agents" element={<AgentsPage />} />
        <Route path="plans" element={<CommissionPlansPage />} />
        <Route path="commissions" element={<CommissionsPage />} />
        <Route path="health" element={<HealthPage />} />
        <Route path="alerts" element={<AlertsPage />} />
      </Routes>
    </div>
  );
}

function TabLink({
  to,
  end,
  children,
}: {
  to: string;
  end?: boolean;
  children: React.ReactNode;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'px-4 py-2 text-sm rounded-t-[var(--rb-radius-sm)] border-b-2 -mb-px transition-colors',
          isActive
            ? 'border-[var(--rb-accent)] text-[var(--rb-fg)] font-medium'
            : 'border-transparent text-[var(--rb-fg-muted)] hover:text-[var(--rb-fg)]',
        )
      }
    >
      {children}
    </NavLink>
  );
}
