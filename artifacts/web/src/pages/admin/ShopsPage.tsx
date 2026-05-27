/**
 * Admin shops list — read-only directory for super-admin.
 */
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { DataTable, Badge, type Column } from '../../design/index.js';
import { api } from '../../lib/api.js';

type Shop = {
  id: string;
  name: string;
  slug: string;
  state: string;
  subscriptionStatus: string;
  suspendedAt: string | null;
  createdAt: string;
};

export function ShopsPage() {
  const { t, i18n } = useTranslation('admin');
  const q = useQuery<{ shops: Shop[] }>({
    queryKey: ['admin', 'shops'],
    queryFn: () => api('/api/admin/shops'),
    refetchInterval: 60_000,
  });

  const fmtDate = (iso: string) =>
    new Intl.DateTimeFormat(i18n.language, { year: 'numeric', month: 'short', day: 'numeric' }).format(
      new Date(iso),
    );

  const subTone = (s: Shop): 'green' | 'yellow' | 'red' | 'neutral' => {
    if (s.suspendedAt) return 'red';
    if (s.subscriptionStatus === 'active') return 'green';
    if (s.subscriptionStatus === 'trial') return 'yellow';
    if (s.subscriptionStatus === 'cancelled') return 'red';
    return 'neutral';
  };

  const columns: Column<Shop>[] = [
    {
      key: 'name',
      header: t('shops.cols.name'),
      cell: (s) => (
        <div className="flex flex-col">
          <span>{s.name}</span>
          <span className="text-xs text-[var(--rb-fg-muted)] rb-mono">{s.slug}</span>
        </div>
      ),
    },
    { key: 'state', header: t('shops.cols.state'), cell: (s) => s.state, align: 'center' },
    {
      key: 'sub',
      header: t('shops.cols.subscription'),
      cell: (s) => <Badge tone={subTone(s)}>{s.subscriptionStatus}</Badge>,
    },
    {
      key: 'created',
      header: t('shops.cols.created'),
      cell: (s) => fmtDate(s.createdAt),
      mono: true,
      align: 'right',
    },
  ];

  return (
    <section className="space-y-4">
      <h2 className="font-[family-name:var(--rb-font-display)] text-2xl font-semibold tracking-tight">
        {t('shops.title')}
      </h2>
      <DataTable
        rows={q.data?.shops ?? []}
        columns={columns}
        rowKey={(s) => s.id}
        empty={t('shops.empty')}
      />
    </section>
  );
}
