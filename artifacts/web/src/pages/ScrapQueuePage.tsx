/**
 * ScrapQueuePage (Module 12) — shop-side disposal queue.
 *
 * Lists scrap tires by status. Owner/manager can select on_hand rows and
 * schedule a haul (post to /api/shop/hauls). Open manifest in a new tab once
 * scheduled. Mark pickup / delivery to advance status.
 */
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge, Button, Card, DataTable, type Column } from '../design/index.js';
import { api, ApiError } from '../lib/api.js';

type ScrapStatus = 'on_hand' | 'awaiting_haul' | 'in_transit' | 'delivered';

type ScrapRow = {
  id: string;
  tireId: string | null;
  status: ScrapStatus;
  reason: string | null;
  haulId: string | null;
  onHandSince: string;
};

type HaulStatus = 'scheduled' | 'in_transit' | 'completed' | 'cancelled';

type HaulRow = {
  id: string;
  haulerId: string;
  destinationFacilityId: string;
  status: HaulStatus;
  scheduledFor: string | null;
  pickedUpAt: string | null;
  deliveredAt: string | null;
  tireCount: number;
  createdAt: string;
};

const STATUS_TONE: Record<ScrapStatus, 'neutral' | 'yellow' | 'green' | 'accent'> = {
  on_hand: 'accent',
  awaiting_haul: 'yellow',
  in_transit: 'yellow',
  delivered: 'green',
};

const HAUL_TONE: Record<HaulStatus, 'neutral' | 'yellow' | 'green' | 'red'> = {
  scheduled: 'yellow',
  in_transit: 'yellow',
  completed: 'green',
  cancelled: 'red',
};

export function ScrapQueuePage() {
  const { t } = useTranslation('dashboard');
  const qc = useQueryClient();

  const scrap = useQuery<{ scrap: ScrapRow[] }>({
    queryKey: ['shop', 'scrap'],
    queryFn: () => api('/api/shop/scrap'),
  });

  const hauls = useQuery<{ hauls: HaulRow[] }>({
    queryKey: ['shop', 'hauls'],
    queryFn: () => api('/api/shop/hauls'),
  });

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [haulerId, setHaulerId] = useState('');
  const [facilityId, setFacilityId] = useState('');
  const [scheduledFor, setScheduledFor] = useState('');

  const onHand = useMemo(
    () => (scrap.data?.scrap ?? []).filter((s) => s.status === 'on_hand'),
    [scrap.data],
  );
  const inFlight = useMemo(
    () => (scrap.data?.scrap ?? []).filter((s) => s.status !== 'on_hand' && s.status !== 'delivered'),
    [scrap.data],
  );

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const schedule = useMutation({
    mutationFn: async () =>
      api('/api/shop/hauls', {
        method: 'POST',
        body: JSON.stringify({
          haulerId,
          destinationFacilityId: facilityId,
          scrapIds: [...selected],
          scheduledFor: scheduledFor ? new Date(scheduledFor).toISOString() : undefined,
        }),
      }),
    onSuccess: () => {
      setSelected(new Set());
      setScheduledFor('');
      void qc.invalidateQueries({ queryKey: ['shop', 'scrap'] });
      void qc.invalidateQueries({ queryKey: ['shop', 'hauls'] });
    },
  });

  const pickup = useMutation({
    mutationFn: (haulId: string) => api(`/api/shop/hauls/${haulId}/pickup`, { method: 'POST' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['shop', 'scrap'] });
      void qc.invalidateQueries({ queryKey: ['shop', 'hauls'] });
    },
  });

  const deliver = useMutation({
    mutationFn: (haulId: string) => api(`/api/shop/hauls/${haulId}/deliver`, { method: 'POST' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['shop', 'scrap'] });
      void qc.invalidateQueries({ queryKey: ['shop', 'hauls'] });
    },
  });

  const onHandCols: Column<ScrapRow>[] = [
    {
      key: 'select',
      header: '',
      width: '36px',
      cell: (r) => (
        <input
          type="checkbox"
          checked={selected.has(r.id)}
          onChange={() => toggle(r.id)}
          aria-label={`select ${r.id}`}
        />
      ),
    },
    {
      key: 'tireId',
      header: 'Tire',
      mono: true,
      cell: (r) => r.tireId?.slice(0, 8) ?? '—',
    },
    { key: 'reason', header: 'Reason', cell: (r) => r.reason ?? '—' },
    {
      key: 'onHandSince',
      header: 'On hand',
      cell: (r) => new Date(r.onHandSince).toLocaleDateString(),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (r) => <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge>,
    },
  ];

  const haulCols: Column<HaulRow>[] = [
    { key: 'id', header: 'Haul', mono: true, cell: (r) => r.id.slice(0, 8) },
    {
      key: 'status',
      header: 'Status',
      cell: (r) => <Badge tone={HAUL_TONE[r.status]}>{r.status}</Badge>,
    },
    { key: 'tireCount', header: 'Tires', align: 'right', cell: (r) => r.tireCount },
    {
      key: 'scheduledFor',
      header: 'Scheduled',
      cell: (r) => (r.scheduledFor ? new Date(r.scheduledFor).toLocaleDateString() : '—'),
    },
    {
      key: 'actions',
      header: '',
      cell: (r) => (
        <div className="flex gap-2 items-center">
          <a
            className="text-xs underline underline-offset-2 text-[var(--rb-fg-muted)] hover:text-[var(--rb-fg)]"
            href={`/api/shop/hauls/${r.id}/manifest`}
            target="_blank"
            rel="noreferrer"
          >
            Manifest
          </a>
          {r.status === 'scheduled' && (
            <Button size="sm" tone="secondary" onClick={() => pickup.mutate(r.id)} disabled={pickup.isPending}>
              Pickup
            </Button>
          )}
          {r.status === 'in_transit' && (
            <Button size="sm" tone="secondary" onClick={() => deliver.mutate(r.id)} disabled={deliver.isPending}>
              Delivered
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-8">
      <header className="flex items-baseline justify-between gap-4 flex-wrap">
        <h1 className="font-[family-name:var(--rb-font-display)] text-4xl font-semibold tracking-tight">
          {t('scrap.title', 'Scrap queue')}
        </h1>
        <div className="text-sm text-[var(--rb-fg-muted)] rb-mono">
          {onHand.length} on hand · {inFlight.length} in flight
        </div>
      </header>

      <Card>
        <h2 className="font-[family-name:var(--rb-font-display)] text-xl font-semibold mb-4">
          {t('scrap.onHand', 'On hand')}
        </h2>
        <DataTable<ScrapRow>
          rows={onHand}
          columns={onHandCols}
          rowKey={(r) => r.id}
          empty={t('scrap.empty', 'No scrap on hand.')}
        />
        {onHand.length > 0 && (
          <div className="mt-6 grid gap-3 md:grid-cols-[1fr_1fr_auto_auto] items-end">
            <label className="block text-sm">
              <span className="block text-xs uppercase tracking-wider text-[var(--rb-fg-muted)] mb-1">
                Hauler ID
              </span>
              <input
                className="w-full h-10 px-3 rounded-[var(--rb-radius-md)] bg-[var(--rb-bg)] border border-[var(--rb-border)] text-[var(--rb-fg)] rb-mono text-xs"
                value={haulerId}
                onChange={(e) => setHaulerId(e.target.value)}
                placeholder="uuid"
              />
            </label>
            <label className="block text-sm">
              <span className="block text-xs uppercase tracking-wider text-[var(--rb-fg-muted)] mb-1">
                Facility ID
              </span>
              <input
                className="w-full h-10 px-3 rounded-[var(--rb-radius-md)] bg-[var(--rb-bg)] border border-[var(--rb-border)] text-[var(--rb-fg)] rb-mono text-xs"
                value={facilityId}
                onChange={(e) => setFacilityId(e.target.value)}
                placeholder="uuid"
              />
            </label>
            <label className="block text-sm">
              <span className="block text-xs uppercase tracking-wider text-[var(--rb-fg-muted)] mb-1">
                Scheduled
              </span>
              <input
                type="datetime-local"
                className="w-full h-10 px-3 rounded-[var(--rb-radius-md)] bg-[var(--rb-bg)] border border-[var(--rb-border)] text-[var(--rb-fg)] text-xs"
                value={scheduledFor}
                onChange={(e) => setScheduledFor(e.target.value)}
                min={new Date(Date.now() - 60_000).toISOString().slice(0, 16)}
              />
            </label>
            <Button
              tone="primary"
              size="md"
              disabled={
                selected.size === 0 || !haulerId || !facilityId || schedule.isPending
              }
              onClick={() => schedule.mutate()}
            >
              {schedule.isPending
                ? 'Scheduling…'
                : `Schedule haul · ${selected.size} tire${selected.size === 1 ? '' : 's'}`}
            </Button>
          </div>
        )}
        {schedule.isError && (
          <div className="mt-3 text-sm text-[var(--rb-alert-red)]">
            {schedule.error instanceof ApiError ? schedule.error.message : 'failed'}
          </div>
        )}
      </Card>

      <Card>
        <h2 className="font-[family-name:var(--rb-font-display)] text-xl font-semibold mb-4">
          {t('scrap.hauls', 'Hauls')}
        </h2>
        <DataTable<HaulRow>
          rows={hauls.data?.hauls ?? []}
          columns={haulCols}
          rowKey={(r) => r.id}
          empty={t('scrap.noHauls', 'No hauls scheduled.')}
        />
      </Card>
    </div>
  );
}
