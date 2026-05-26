import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { StatTile } from '../design/index.js';
import { api } from '../lib/api.js';

type ShopStats = {
  inStock: number;
  soldToday: number;
  revenueTodayCents: number;
  scrapOnHand: number;
  intakeReview: number;
};

function formatUsd(cents: number, lang: string): string {
  return new Intl.NumberFormat(lang === 'es' ? 'es-US' : 'en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export function ShopDashboardPage() {
  const { t, i18n } = useTranslation('dashboard');
  const stats = useQuery<ShopStats>({
    queryKey: ['shop', 'stats'],
    queryFn: () => api<ShopStats>('/api/shop/stats'),
    refetchInterval: 30_000,
  });

  const fmtN = (n: number | undefined) =>
    stats.isLoading ? '—' : new Intl.NumberFormat(i18n.language).format(n ?? 0);
  const fmtMoney = (cents: number | undefined) =>
    stats.isLoading ? '—' : formatUsd(cents ?? 0, i18n.language);

  return (
    <div className="space-y-8">
      <h1 className="font-[family-name:var(--rb-font-display)] text-4xl font-semibold tracking-tight">
        {t('headline')}
      </h1>
      {stats.isError && (
        <div className="rounded-[var(--rb-radius-md)] border border-[var(--rb-alert-red)] bg-[color-mix(in_oklch,var(--rb-alert-red)_10%,transparent)] px-4 py-3 text-sm text-[var(--rb-alert-red)]">
          {t('error.statsLoad', 'Could not load stats — retrying…')}
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <StatTile label={t('kpis.inStock')} value={fmtN(stats.data?.inStock)} />
        <StatTile label={t('kpis.soldToday')} value={fmtN(stats.data?.soldToday)} />
        <StatTile label={t('kpis.revenueToday')} value={fmtMoney(stats.data?.revenueTodayCents)} />
        <StatTile label={t('kpis.scrapOnHand')} value={fmtN(stats.data?.scrapOnHand)} />
        <StatTile label={t('kpis.intakeReview')} value={fmtN(stats.data?.intakeReview)} />
      </div>
    </div>
  );
}
