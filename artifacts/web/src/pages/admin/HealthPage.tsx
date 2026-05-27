/**
 * Account health — reads /api/admin/health (most recent 200 signals).
 * Phase 2.5 placeholder: weekly aggregator job (Module 16) populates rows.
 */
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { DataTable, Badge, type Column } from '../../design/index.js';
import { api } from '../../lib/api.js';

type Signal = {
  id: string;
  shopId: string;
  period: string;
  loginFrequency: number | null;
  intakeVolume: number | null;
  salesActivity: number | null;
  computedScore: number;
  band: 'green' | 'yellow' | 'red';
};

type Shop = { id: string; name: string };

export function HealthPage() {
  const { t } = useTranslation('admin');

  const signals = useQuery<{ signals: Signal[] }>({
    queryKey: ['admin', 'health'],
    queryFn: () => api('/api/admin/health'),
    refetchInterval: 120_000,
  });
  const shops = useQuery<{ shops: Shop[] }>({
    queryKey: ['admin', 'shops'],
    queryFn: () => api('/api/admin/shops'),
  });
  const shopMap = new Map(shops.data?.shops.map((s) => [s.id, s.name]));

  const tone = (b: Signal['band']) => b;

  const columns: Column<Signal>[] = [
    {
      key: 'shop',
      header: t('health.cols.shop'),
      cell: (s) => shopMap.get(s.shopId) ?? s.shopId.slice(0, 8),
    },
    { key: 'period', header: t('health.cols.period'), cell: (s) => s.period, mono: true },
    {
      key: 'score',
      header: t('health.cols.score'),
      cell: (s) => s.computedScore,
      mono: true,
      align: 'right',
    },
    {
      key: 'band',
      header: t('health.cols.band'),
      cell: (s) => <Badge tone={tone(s.band)}>{s.band}</Badge>,
      align: 'center',
    },
    {
      key: 'login',
      header: t('health.cols.login'),
      cell: (s) => s.loginFrequency ?? '—',
      mono: true,
      align: 'right',
    },
    {
      key: 'intake',
      header: t('health.cols.intake'),
      cell: (s) => s.intakeVolume ?? '—',
      mono: true,
      align: 'right',
    },
    {
      key: 'sales',
      header: t('health.cols.sales'),
      cell: (s) => s.salesActivity ?? '—',
      mono: true,
      align: 'right',
    },
  ];

  return (
    <section className="space-y-4">
      <h2 className="font-[family-name:var(--rb-font-display)] text-2xl font-semibold tracking-tight">
        {t('health.title')}
      </h2>
      <DataTable
        rows={signals.data?.signals ?? []}
        columns={columns}
        rowKey={(s) => s.id}
        empty={t('health.empty')}
      />
    </section>
  );
}
