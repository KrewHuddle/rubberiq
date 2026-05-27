/**
 * Super-admin dashboard — platform KPIs + jumps to admin surfaces.
 * Pulls /api/admin/stats. 30s refetch.
 */
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { StatTile } from '../design/index.js';
import { api } from '../lib/api.js';

type AdminStats = {
  shopsLive: number;
  mrrCents: number;
  tiresLogged: number;
  scrapHauled: number;
  agentsActive: number;
};

function fmtUsd(cents: number, lang: string): string {
  return new Intl.NumberFormat(lang === 'es' ? 'es-US' : 'en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export function SuperAdminPage() {
  const { i18n } = useTranslation();
  const stats = useQuery<AdminStats>({
    queryKey: ['admin', 'stats'],
    queryFn: () => api<AdminStats>('/api/admin/stats'),
    refetchInterval: 30_000,
  });

  const fmtN = (n: number | undefined) =>
    stats.isLoading ? '—' : new Intl.NumberFormat(i18n.language).format(n ?? 0);
  const fmtMoney = (cents: number | undefined) =>
    stats.isLoading ? '—' : fmtUsd(cents ?? 0, i18n.language);

  return (
    <div className="space-y-8">
      <header className="flex items-baseline justify-between gap-4 flex-wrap">
        <h1 className="font-[family-name:var(--rb-font-display)] text-4xl font-semibold tracking-tight">
          Platform
        </h1>
        <div className="text-sm text-[var(--rb-fg-muted)] rb-mono">super-admin · live</div>
      </header>

      {stats.isError && (
        <div className="rounded-[var(--rb-radius-md)] border border-[var(--rb-alert-red)] bg-[color-mix(in_oklch,var(--rb-alert-red)_10%,transparent)] px-4 py-3 text-sm text-[var(--rb-alert-red)]">
          Could not load stats — retrying…
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <StatTile label="Shops live" value={fmtN(stats.data?.shopsLive)} />
        <StatTile label="MRR" value={fmtMoney(stats.data?.mrrCents)} />
        <StatTile label="Tires logged" value={fmtN(stats.data?.tiresLogged)} />
        <StatTile label="Scrap hauled" value={fmtN(stats.data?.scrapHauled)} />
        <StatTile label="Sales agents" value={fmtN(stats.data?.agentsActive)} />
      </div>

      <section>
        <h2 className="font-[family-name:var(--rb-font-display)] text-xl font-semibold mb-3">
          Admin surfaces
        </h2>
        <p className="text-sm text-[var(--rb-fg-muted)]">
          Backend live at <code className="rb-mono text-xs">/api/admin/*</code> — shops, agents,
          assign, commission plans, commissions, health, alerts, haulers, facilities. UI for
          each lands as needed.
        </p>
      </section>
    </div>
  );
}
