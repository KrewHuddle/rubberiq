/**
 * Admin overview — platform KPIs. Pulls /api/admin/stats with 30s refetch.
 */
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { StatTile } from '../../design/index.js';
import { api } from '../../lib/api.js';

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

export function OverviewPage() {
  const { t, i18n } = useTranslation('admin');
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
    <div className="space-y-6">
      {stats.isError && (
        <div className="rounded-[var(--rb-radius-md)] border border-[var(--rb-alert-red)] bg-[color-mix(in_oklch,var(--rb-alert-red)_10%,transparent)] px-4 py-3 text-sm text-[var(--rb-alert-red)]">
          {t('overview.errLoad')}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <StatTile label={t('overview.stats.shopsLive')} value={fmtN(stats.data?.shopsLive)} />
        <StatTile label={t('overview.stats.mrr')} value={fmtMoney(stats.data?.mrrCents)} />
        <StatTile label={t('overview.stats.tiresLogged')} value={fmtN(stats.data?.tiresLogged)} />
        <StatTile label={t('overview.stats.scrapHauled')} value={fmtN(stats.data?.scrapHauled)} />
        <StatTile label={t('overview.stats.agents')} value={fmtN(stats.data?.agentsActive)} />
      </div>
    </div>
  );
}
