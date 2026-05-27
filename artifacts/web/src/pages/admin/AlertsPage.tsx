/**
 * Account alerts — reads /api/admin/alerts.
 * Phase 2.5 placeholder: Module 17 emission rules populate rows.
 */
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { DataTable, Badge, type Column } from '../../design/index.js';
import { api } from '../../lib/api.js';

type Alert = {
  id: string;
  shopId: string;
  agentId: string | null;
  type: string;
  severity: number;
  message: string;
  status: 'open' | 'acknowledged' | 'resolved';
  createdAt: string;
};

type Shop = { id: string; name: string };

export function AlertsPage() {
  const { t, i18n } = useTranslation('admin');

  const alerts = useQuery<{ alerts: Alert[] }>({
    queryKey: ['admin', 'alerts'],
    queryFn: () => api('/api/admin/alerts'),
    refetchInterval: 60_000,
  });
  const shops = useQuery<{ shops: Shop[] }>({
    queryKey: ['admin', 'shops'],
    queryFn: () => api('/api/admin/shops'),
  });
  const shopMap = new Map(shops.data?.shops.map((s) => [s.id, s.name]));

  const sevTone = (s: number): 'red' | 'yellow' | 'neutral' => {
    if (s >= 3) return 'red';
    if (s === 2) return 'yellow';
    return 'neutral';
  };
  const statusTone = (s: Alert['status']): 'red' | 'yellow' | 'green' => {
    if (s === 'open') return 'red';
    if (s === 'acknowledged') return 'yellow';
    return 'green';
  };

  const columns: Column<Alert>[] = [
    {
      key: 'shop',
      header: t('alerts.cols.shop'),
      cell: (a) => shopMap.get(a.shopId) ?? a.shopId.slice(0, 8),
    },
    { key: 'type', header: t('alerts.cols.type'), cell: (a) => a.type, mono: true },
    {
      key: 'sev',
      header: t('alerts.cols.severity'),
      cell: (a) => <Badge tone={sevTone(a.severity)}>{a.severity}</Badge>,
      align: 'center',
    },
    { key: 'msg', header: t('alerts.cols.message'), cell: (a) => a.message },
    {
      key: 'status',
      header: t('alerts.cols.status'),
      cell: (a) => <Badge tone={statusTone(a.status)}>{a.status}</Badge>,
      align: 'center',
    },
    {
      key: 'created',
      header: t('alerts.cols.created'),
      cell: (a) => new Date(a.createdAt).toLocaleDateString(i18n.language),
      mono: true,
      align: 'right',
    },
  ];

  return (
    <section className="space-y-4">
      <h2 className="font-[family-name:var(--rb-font-display)] text-2xl font-semibold tracking-tight">
        {t('alerts.title')}
      </h2>
      <DataTable
        rows={alerts.data?.alerts ?? []}
        columns={columns}
        rowKey={(a) => a.id}
        empty={t('alerts.empty')}
      />
    </section>
  );
}
