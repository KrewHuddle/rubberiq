/**
 * Commission ledger — list commission_events, optional agentId filter.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { DataTable, Badge, type Column } from '../../design/index.js';
import { api } from '../../lib/api.js';

type Event = {
  id: string;
  agentId: string;
  shopId: string;
  type: 'signup' | 'residual' | 'upsell' | 'clawback';
  basisCents: number;
  rateAppliedBps: number | null;
  amountEarnedCents: number;
  period: string;
  paidOutAt: string | null;
  createdAt: string;
};

type Agent = { id: string; name: string };
type Shop = { id: string; name: string };

export function CommissionsPage() {
  const { t, i18n } = useTranslation('admin');
  const [agentId, setAgentId] = useState<string>('');

  const events = useQuery<{ events: Event[] }>({
    queryKey: ['admin', 'commissions', agentId || 'all'],
    queryFn: () =>
      api(agentId ? `/api/admin/commissions?agentId=${encodeURIComponent(agentId)}` : '/api/admin/commissions'),
    refetchInterval: 60_000,
  });
  const agents = useQuery<{ agents: Agent[] }>({
    queryKey: ['admin', 'agents'],
    queryFn: () => api('/api/admin/agents'),
  });
  const shops = useQuery<{ shops: Shop[] }>({
    queryKey: ['admin', 'shops'],
    queryFn: () => api('/api/admin/shops'),
  });

  const agentMap = new Map(agents.data?.agents.map((a) => [a.id, a.name]));
  const shopMap = new Map(shops.data?.shops.map((s) => [s.id, s.name]));

  const fmtUsd = (cents: number) =>
    new Intl.NumberFormat(i18n.language === 'es' ? 'es-US' : 'en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  const fmtBps = (bps: number | null) => (bps == null ? '—' : `${(bps / 100).toFixed(2)}%`);

  const typeTone = (type: Event['type']): 'green' | 'accent' | 'yellow' | 'red' => {
    if (type === 'signup') return 'accent';
    if (type === 'residual') return 'green';
    if (type === 'upsell') return 'yellow';
    return 'red';
  };

  const columns: Column<Event>[] = [
    { key: 'period', header: t('commissions.cols.period'), cell: (e) => e.period, mono: true },
    {
      key: 'agent',
      header: t('commissions.cols.agent'),
      cell: (e) => agentMap.get(e.agentId) ?? e.agentId.slice(0, 8),
    },
    {
      key: 'shop',
      header: t('commissions.cols.shop'),
      cell: (e) => shopMap.get(e.shopId) ?? e.shopId.slice(0, 8),
    },
    {
      key: 'type',
      header: t('commissions.cols.type'),
      cell: (e) => <Badge tone={typeTone(e.type)}>{e.type}</Badge>,
    },
    {
      key: 'basis',
      header: t('commissions.cols.basis'),
      cell: (e) => fmtUsd(e.basisCents),
      mono: true,
      align: 'right',
    },
    {
      key: 'rate',
      header: t('commissions.cols.rate'),
      cell: (e) => fmtBps(e.rateAppliedBps),
      mono: true,
      align: 'right',
    },
    {
      key: 'amount',
      header: t('commissions.cols.amount'),
      cell: (e) => fmtUsd(e.amountEarnedCents),
      mono: true,
      align: 'right',
    },
    {
      key: 'paid',
      header: t('commissions.cols.paid'),
      cell: (e) =>
        e.paidOutAt ? (
          <Badge tone="green">{new Date(e.paidOutAt).toLocaleDateString(i18n.language)}</Badge>
        ) : (
          <Badge tone="neutral">—</Badge>
        ),
      align: 'center',
    },
  ];

  const fieldCls =
    'rounded-[var(--rb-radius-sm)] border border-[var(--rb-border)] bg-[var(--rb-bg-elev)] px-3 py-2 text-sm focus:outline-none focus:border-[var(--rb-border-strong)] focus:ring-2 focus:ring-[var(--rb-ring)]';

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h2 className="font-[family-name:var(--rb-font-display)] text-2xl font-semibold tracking-tight">
          {t('commissions.title')}
        </h2>
        <div className="flex items-center gap-2">
          <label htmlFor="filter-agent" className="text-xs uppercase tracking-wider text-[var(--rb-fg-muted)]">
            {t('commissions.filterAgent')}
          </label>
          <select
            id="filter-agent"
            className={fieldCls}
            value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
          >
            <option value="">{t('commissions.allAgents')}</option>
            {agents.data?.agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <DataTable
        rows={events.data?.events ?? []}
        columns={columns}
        rowKey={(e) => e.id}
        empty={t('commissions.empty')}
      />
    </section>
  );
}
