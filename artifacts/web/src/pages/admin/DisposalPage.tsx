/**
 * Disposal dispatch (Module 12b/12c) — the platform side of the disposal
 * service, the second revenue stream.
 *
 * Reads scrap-on-hand across every shop as a demand signal, batches it into
 * truck runs ("tires until full"), reconciles disposal fees collected against
 * the hauler's cost, and manages the verified hauler/facility directories that
 * gate dispatch.
 */
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Badge, Button, DataTable, StatTile, type Column } from '../../design/index.js';
import { api, ApiError } from '../../lib/api.js';

type QueueRow = {
  shopId: string;
  shopName: string;
  state: string;
  city: string | null;
  onHandCount: number;
  oldestOnHandSince: string;
  daysWaiting: number;
  disposalFeeCents: number;
};

type MapRow = {
  state: string;
  city: string | null;
  shopCount: number;
  onHandCount: number;
  oldestOnHandSince: string | null;
};

type Route = {
  id: string;
  haulerId: string;
  destinationFacilityId: string;
  status: 'scheduled' | 'in_transit' | 'completed' | 'cancelled';
  capacity: number;
  plannedTireCount: number;
  stopCount: number;
  state: string | null;
  scheduledFor: string | null;
  collectedCents: number;
  haulCostCents: number;
  marginCents: number | null;
  reconciledAt: string | null;
  createdAt: string;
};

type Haul = {
  id: string;
  shopId: string;
  tireCount: number;
  status: string;
  collectedCents: number;
  feeCents: number;
  marginCents: number | null;
};

type Hauler = {
  id: string;
  name: string;
  state: string;
  permitNumber: string | null;
  truckCapacity: number | null;
  contactName: string | null;
  contactPhone: string | null;
  verified: boolean;
};

type Facility = {
  id: string;
  name: string;
  state: string;
  permitNumber: string | null;
  city: string | null;
  verified: boolean;
};

type Shop = { id: string; name: string };

const fieldCls =
  'w-full rounded-[var(--rb-radius-sm)] border border-[var(--rb-border)] bg-[var(--rb-bg-elev)] px-3 py-2 text-sm focus:outline-none focus:border-[var(--rb-border-strong)] focus:ring-2 focus:ring-[var(--rb-ring)]';
const labelCls = 'block text-xs uppercase tracking-wider text-[var(--rb-fg-muted)] mb-1';
const panelCls =
  'space-y-4 rounded-[var(--rb-radius-lg)] border border-[var(--rb-border)] bg-[var(--rb-bg-elev)] p-5';

export function DisposalPage() {
  const { t, i18n } = useTranslation('admin');
  const qc = useQueryClient();

  const money = (cents: number) =>
    new Intl.NumberFormat(i18n.language, { style: 'currency', currency: 'USD' }).format(cents / 100);
  const fmtDate = (iso: string) =>
    new Intl.DateTimeFormat(i18n.language, { month: 'short', day: 'numeric', year: 'numeric' }).format(
      new Date(iso),
    );
  const errText = (e: ApiError) => t(`disposal.errors.${e.message}`, { defaultValue: e.message });

  const [stateFilter, setStateFilter] = useState('');

  const queue = useQuery<{ queue: QueueRow[] }>({
    queryKey: ['admin', 'disposal', 'queue', stateFilter],
    queryFn: () => api(`/api/admin/disposal/queue${stateFilter ? `?state=${stateFilter}` : ''}`),
    refetchInterval: 60_000,
  });
  const scrapMap = useQuery<{ map: MapRow[] }>({
    queryKey: ['admin', 'disposal', 'map'],
    queryFn: () => api('/api/admin/disposal/scrap-map'),
  });
  const routes = useQuery<{ routes: Route[] }>({
    queryKey: ['admin', 'disposal', 'routes'],
    queryFn: () => api('/api/admin/disposal/routes'),
  });
  const haulers = useQuery<{ haulers: Hauler[] }>({
    queryKey: ['admin', 'haulers'],
    queryFn: () => api('/api/admin/haulers'),
  });
  const facilities = useQuery<{ facilities: Facility[] }>({
    queryKey: ['admin', 'facilities'],
    queryFn: () => api('/api/admin/facilities'),
  });
  const shops = useQuery<{ shops: Shop[] }>({
    queryKey: ['admin', 'shops'],
    queryFn: () => api('/api/admin/shops'),
  });

  const shopName = (id: string) =>
    shops.data?.shops.find((s) => s.id === id)?.name ?? id.slice(0, 8);
  const haulerName = (id: string) =>
    haulers.data?.haulers.find((h) => h.id === id)?.name ?? id.slice(0, 8);

  const queueRows = queue.data?.queue ?? [];
  const tiresOnHand = queueRows.reduce((n, r) => n + r.onHandCount, 0);
  const longestWait = queueRows.reduce((n, r) => Math.max(n, r.daysWaiting), 0);
  const openRoutes =
    routes.data?.routes.filter((r) => r.status === 'scheduled' || r.status === 'in_transit').length ??
    0;

  const invalidateDispatch = () => {
    void qc.invalidateQueries({ queryKey: ['admin', 'disposal'] });
  };

  /* ---------- route builder ---------- */
  const verifiedHaulers = haulers.data?.haulers.filter((h) => h.verified) ?? [];
  const verifiedFacilities = facilities.data?.facilities.filter((f) => f.verified) ?? [];

  const [builder, setBuilder] = useState({
    haulerId: '',
    destinationFacilityId: '',
    capacity: '',
    maxStops: '',
    allowPartial: true,
    scheduledFor: '',
  });
  const [builderErr, setBuilderErr] = useState<string | null>(null);
  const [builderOk, setBuilderOk] = useState<{ tires: number; stops: number } | null>(null);

  const createRoute = useMutation<
    { routeId: string; plannedTireCount: number; stopCount: number },
    ApiError,
    void
  >({
    mutationFn: () =>
      api('/api/admin/disposal/routes', {
        method: 'POST',
        body: JSON.stringify({
          haulerId: builder.haulerId,
          destinationFacilityId: builder.destinationFacilityId,
          capacity: builder.capacity ? Number(builder.capacity) : undefined,
          maxStops: builder.maxStops ? Number(builder.maxStops) : undefined,
          allowPartial: builder.allowPartial,
          state: stateFilter || undefined,
          scheduledFor: builder.scheduledFor
            ? new Date(builder.scheduledFor).toISOString()
            : undefined,
        }),
      }),
    onSuccess: (d) => {
      setBuilderErr(null);
      setBuilderOk({ tires: d.plannedTireCount, stops: d.stopCount });
      invalidateDispatch();
    },
    onError: (e) => {
      setBuilderOk(null);
      setBuilderErr(errText(e));
    },
  });

  /* ---------- selected route ---------- */
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const routeDetail = useQuery<{ route: Route; hauls: Haul[] }>({
    queryKey: ['admin', 'disposal', 'route', selectedRouteId],
    queryFn: () => api(`/api/admin/disposal/routes/${selectedRouteId}`),
    enabled: !!selectedRouteId,
  });

  const [haulCostCents, setHaulCostCents] = useState('');
  const [detailErr, setDetailErr] = useState<string | null>(null);
  const [detailOk, setDetailOk] = useState<string | null>(null);

  const reconcile = useMutation<unknown, ApiError, void>({
    mutationFn: () =>
      api(`/api/admin/disposal/routes/${selectedRouteId}/reconcile`, {
        method: 'POST',
        body: JSON.stringify({ haulCostCents: Number(haulCostCents || 0) }),
      }),
    onSuccess: () => {
      setDetailErr(null);
      setDetailOk(t('disposal.detail.reconciled'));
      invalidateDispatch();
    },
    onError: (e) => {
      setDetailOk(null);
      setDetailErr(errText(e));
    },
  });

  const advance = useMutation<unknown, ApiError, 'in_transit' | 'completed' | 'cancelled'>({
    mutationFn: (to) =>
      api(`/api/admin/disposal/routes/${selectedRouteId}/advance`, {
        method: 'POST',
        body: JSON.stringify({ to }),
      }),
    onSuccess: () => {
      setDetailErr(null);
      setDetailOk(null);
      invalidateDispatch();
    },
    onError: (e) => setDetailErr(errText(e)),
  });

  /* ---------- directories ---------- */
  const [haulerForm, setHaulerForm] = useState({
    name: '',
    state: '',
    permitNumber: '',
    truckCapacity: '',
    contactName: '',
    contactPhone: '',
  });
  const [haulerErr, setHaulerErr] = useState<string | null>(null);

  const addHauler = useMutation<unknown, ApiError, void>({
    mutationFn: () =>
      api('/api/admin/haulers', {
        method: 'POST',
        body: JSON.stringify({
          name: haulerForm.name,
          state: haulerForm.state.toUpperCase(),
          permitNumber: haulerForm.permitNumber || undefined,
          truckCapacity: haulerForm.truckCapacity ? Number(haulerForm.truckCapacity) : undefined,
          contactName: haulerForm.contactName || undefined,
          contactPhone: haulerForm.contactPhone || undefined,
        }),
      }),
    onSuccess: () => {
      setHaulerErr(null);
      setHaulerForm({
        name: '',
        state: '',
        permitNumber: '',
        truckCapacity: '',
        contactName: '',
        contactPhone: '',
      });
      void qc.invalidateQueries({ queryKey: ['admin', 'haulers'] });
    },
    onError: (e) => setHaulerErr(errText(e)),
  });

  const toggleHauler = useMutation<unknown, ApiError, Hauler>({
    mutationFn: (h) =>
      api(`/api/admin/haulers/${h.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ verified: !h.verified }),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin', 'haulers'] }),
  });

  const [facilityForm, setFacilityForm] = useState({
    name: '',
    state: '',
    permitNumber: '',
    city: '',
  });
  const [facilityErr, setFacilityErr] = useState<string | null>(null);

  const addFacility = useMutation<unknown, ApiError, void>({
    mutationFn: () =>
      api('/api/admin/facilities', {
        method: 'POST',
        body: JSON.stringify({
          name: facilityForm.name,
          state: facilityForm.state.toUpperCase(),
          permitNumber: facilityForm.permitNumber || undefined,
          city: facilityForm.city || undefined,
        }),
      }),
    onSuccess: () => {
      setFacilityErr(null);
      setFacilityForm({ name: '', state: '', permitNumber: '', city: '' });
      void qc.invalidateQueries({ queryKey: ['admin', 'facilities'] });
    },
    onError: (e) => setFacilityErr(errText(e)),
  });

  const toggleFacility = useMutation<unknown, ApiError, Facility>({
    mutationFn: (f) =>
      api(`/api/admin/facilities/${f.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ verified: !f.verified }),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin', 'facilities'] }),
  });

  /* ---------- columns ---------- */
  const queueCols: Column<QueueRow>[] = [
    { key: 'shop', header: t('disposal.queue.cols.shop'), cell: (r) => r.shopName },
    {
      key: 'location',
      header: t('disposal.queue.cols.location'),
      cell: (r) => [r.city, r.state].filter(Boolean).join(', '),
    },
    {
      key: 'onHand',
      header: t('disposal.queue.cols.onHand'),
      cell: (r) => r.onHandCount,
      mono: true,
      align: 'right',
    },
    {
      key: 'waiting',
      header: t('disposal.queue.cols.waiting'),
      cell: (r) => (
        <Badge tone={r.daysWaiting >= 30 ? 'red' : r.daysWaiting >= 14 ? 'yellow' : 'neutral'}>
          {t('disposal.dayCount', { count: r.daysWaiting })}
        </Badge>
      ),
      align: 'center',
    },
    {
      key: 'fee',
      header: t('disposal.queue.cols.fee'),
      cell: (r) => money(r.disposalFeeCents),
      mono: true,
      align: 'right',
    },
  ];

  const mapCols: Column<MapRow>[] = [
    {
      key: 'location',
      header: t('disposal.map.cols.location'),
      cell: (r) => [r.city, r.state].filter(Boolean).join(', '),
    },
    {
      key: 'shops',
      header: t('disposal.map.cols.shops'),
      cell: (r) => r.shopCount,
      mono: true,
      align: 'right',
    },
    {
      key: 'onHand',
      header: t('disposal.map.cols.onHand'),
      cell: (r) => r.onHandCount,
      mono: true,
      align: 'right',
    },
    {
      key: 'oldest',
      header: t('disposal.map.cols.oldest'),
      cell: (r) => (r.oldestOnHandSince ? fmtDate(r.oldestOnHandSince) : '—'),
      mono: true,
      align: 'right',
    },
  ];

  const statusTone = (s: Route['status']) =>
    s === 'completed' ? 'green' : s === 'cancelled' ? 'red' : s === 'in_transit' ? 'accent' : 'neutral';

  const routeCols: Column<Route>[] = [
    {
      key: 'created',
      header: t('disposal.routes.cols.created'),
      cell: (r) => fmtDate(r.createdAt),
      mono: true,
    },
    { key: 'hauler', header: t('disposal.routes.cols.hauler'), cell: (r) => haulerName(r.haulerId) },
    {
      key: 'tires',
      header: t('disposal.routes.cols.tires'),
      cell: (r) => `${r.plannedTireCount}/${r.capacity}`,
      mono: true,
      align: 'right',
    },
    {
      key: 'stops',
      header: t('disposal.routes.cols.stops'),
      cell: (r) => r.stopCount,
      mono: true,
      align: 'right',
    },
    {
      key: 'status',
      header: t('disposal.routes.cols.status'),
      cell: (r) => <Badge tone={statusTone(r.status)}>{t(`disposal.status.${r.status}`)}</Badge>,
      align: 'center',
    },
    {
      key: 'margin',
      header: t('disposal.routes.cols.margin'),
      cell: (r) =>
        r.reconciledAt ? (
          <span
            className={
              (r.marginCents ?? 0) >= 0
                ? 'text-[var(--rb-alert-green)]'
                : 'text-[var(--rb-alert-red)]'
            }
          >
            {money(r.marginCents ?? 0)}
          </span>
        ) : (
          '—'
        ),
      mono: true,
      align: 'right',
    },
    {
      key: 'actions',
      header: '',
      cell: (r) => (
        <Button
          type="button"
          tone="ghost"
          size="sm"
          onClick={() => {
            setSelectedRouteId(r.id);
            setHaulCostCents(String(r.haulCostCents || ''));
            setDetailErr(null);
            setDetailOk(null);
          }}
        >
          {t('disposal.routes.open')}
        </Button>
      ),
      align: 'right',
    },
  ];

  const haulerCols: Column<Hauler>[] = [
    { key: 'name', header: t('disposal.haulers.cols.name'), cell: (h) => h.name },
    { key: 'state', header: t('disposal.haulers.cols.state'), cell: (h) => h.state, mono: true },
    {
      key: 'permit',
      header: t('disposal.haulers.cols.permit'),
      cell: (h) => h.permitNumber ?? '—',
      mono: true,
    },
    {
      key: 'capacity',
      header: t('disposal.haulers.cols.capacity'),
      cell: (h) => h.truckCapacity ?? '—',
      mono: true,
      align: 'right',
    },
    {
      key: 'verified',
      header: t('disposal.haulers.cols.verified'),
      cell: (h) => (
        <Button type="button" tone="ghost" size="sm" onClick={() => toggleHauler.mutate(h)}>
          <Badge tone={h.verified ? 'green' : 'neutral'}>
            {h.verified ? t('disposal.verified') : t('disposal.unverified')}
          </Badge>
        </Button>
      ),
      align: 'center',
    },
  ];

  const facilityCols: Column<Facility>[] = [
    { key: 'name', header: t('disposal.facilities.cols.name'), cell: (f) => f.name },
    { key: 'state', header: t('disposal.facilities.cols.state'), cell: (f) => f.state, mono: true },
    {
      key: 'permit',
      header: t('disposal.facilities.cols.permit'),
      cell: (f) => f.permitNumber ?? '—',
      mono: true,
    },
    { key: 'city', header: t('disposal.facilities.cols.city'), cell: (f) => f.city ?? '—' },
    {
      key: 'verified',
      header: t('disposal.facilities.cols.verified'),
      cell: (f) => (
        <Button type="button" tone="ghost" size="sm" onClick={() => toggleFacility.mutate(f)}>
          <Badge tone={f.verified ? 'green' : 'neutral'}>
            {f.verified ? t('disposal.verified') : t('disposal.unverified')}
          </Badge>
        </Button>
      ),
      align: 'center',
    },
  ];

  const stopCols: Column<Haul>[] = [
    { key: 'shop', header: t('disposal.detail.stopCols.shop'), cell: (h) => shopName(h.shopId) },
    {
      key: 'tires',
      header: t('disposal.detail.stopCols.tires'),
      cell: (h) => h.tireCount,
      mono: true,
      align: 'right',
    },
    {
      key: 'collected',
      header: t('disposal.detail.stopCols.collected'),
      cell: (h) => money(h.collectedCents),
      mono: true,
      align: 'right',
    },
    {
      key: 'cost',
      header: t('disposal.detail.stopCols.cost'),
      cell: (h) => money(h.feeCents),
      mono: true,
      align: 'right',
    },
    {
      key: 'margin',
      header: t('disposal.detail.stopCols.margin'),
      cell: (h) => (h.marginCents == null ? '—' : money(h.marginCents)),
      mono: true,
      align: 'right',
    },
  ];

  const states = [...new Set(queueRows.map((r) => r.state))].sort();
  const canDispatch = verifiedHaulers.length > 0 && verifiedFacilities.length > 0;

  const onCreateRoute = (e: FormEvent) => {
    e.preventDefault();
    createRoute.mutate();
  };

  const selectedRoute = routeDetail.data?.route;

  return (
    <section className="space-y-8">
      <h2 className="font-[family-name:var(--rb-font-display)] text-2xl font-semibold tracking-tight">
        {t('disposal.title')}
      </h2>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label={t('disposal.stats.shopsWaiting')} value={queueRows.length} />
        <StatTile label={t('disposal.stats.tiresOnHand')} value={tiresOnHand} />
        <StatTile
          label={t('disposal.stats.longestWait')}
          value={t('disposal.dayCount', { count: longestWait })}
        />
        <StatTile label={t('disposal.stats.openRoutes')} value={openRoutes} />
      </div>

      {/* --- pickup queue --- */}
      <div className="space-y-4">
        <div className="flex items-baseline justify-between gap-4 flex-wrap">
          <h3 className="font-[family-name:var(--rb-font-display)] text-lg font-medium">
            {t('disposal.queue.title')}
          </h3>
          <label className="flex items-center gap-2 text-sm">
            <span className="text-[var(--rb-fg-muted)]">{t('disposal.builder.state')}</span>
            <select
              className={fieldCls}
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value)}
            >
              <option value="">{t('disposal.builder.allStates')}</option>
              {states.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        </div>
        <DataTable
          rows={queueRows}
          columns={queueCols}
          rowKey={(r) => r.shopId}
          empty={t('disposal.queue.empty')}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* --- route builder --- */}
        <form onSubmit={onCreateRoute} className={panelCls}>
          <h3 className="font-[family-name:var(--rb-font-display)] text-lg font-medium">
            {t('disposal.builder.title')}
          </h3>

          {!canDispatch && (
            <div className="text-sm text-[var(--rb-alert-yellow)]">
              {t('disposal.builder.needVerified')}
            </div>
          )}

          <div>
            <label className={labelCls} htmlFor="route-hauler">
              {t('disposal.builder.hauler')}
            </label>
            <select
              id="route-hauler"
              className={fieldCls}
              required
              value={builder.haulerId}
              onChange={(e) => setBuilder((b) => ({ ...b, haulerId: e.target.value }))}
            >
              <option value="">—</option>
              {verifiedHaulers.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name} ({h.state})
                  {h.truckCapacity ? ` · ${h.truckCapacity}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelCls} htmlFor="route-facility">
              {t('disposal.builder.facility')}
            </label>
            <select
              id="route-facility"
              className={fieldCls}
              required
              value={builder.destinationFacilityId}
              onChange={(e) =>
                setBuilder((b) => ({ ...b, destinationFacilityId: e.target.value }))
              }
            >
              <option value="">—</option>
              {verifiedFacilities.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} ({f.state})
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls} htmlFor="route-capacity">
                {t('disposal.builder.capacity')}
              </label>
              <input
                id="route-capacity"
                type="number"
                min={1}
                className={fieldCls}
                value={builder.capacity}
                onChange={(e) => setBuilder((b) => ({ ...b, capacity: e.target.value }))}
              />
              <p className="mt-1 text-xs text-[var(--rb-fg-muted)]">
                {t('disposal.builder.capacityHint')}
              </p>
            </div>
            <div>
              <label className={labelCls} htmlFor="route-maxstops">
                {t('disposal.builder.maxStops')}
              </label>
              <input
                id="route-maxstops"
                type="number"
                min={1}
                className={fieldCls}
                value={builder.maxStops}
                onChange={(e) => setBuilder((b) => ({ ...b, maxStops: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <label className={labelCls} htmlFor="route-scheduled">
              {t('disposal.builder.scheduledFor')}
            </label>
            <input
              id="route-scheduled"
              type="datetime-local"
              className={fieldCls}
              value={builder.scheduledFor}
              onChange={(e) => setBuilder((b) => ({ ...b, scheduledFor: e.target.value }))}
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={builder.allowPartial}
              onChange={(e) => setBuilder((b) => ({ ...b, allowPartial: e.target.checked }))}
            />
            {t('disposal.builder.allowPartial')}
          </label>

          {builderErr && <div className="text-sm text-[var(--rb-alert-red)]">{builderErr}</div>}
          {builderOk && (
            <div className="text-sm text-[var(--rb-alert-green)]">
              {t('disposal.builder.created', builderOk)}
            </div>
          )}

          <Button type="submit" disabled={!canDispatch || createRoute.isPending}>
            {t('disposal.builder.submit')}
          </Button>
        </form>

        {/* --- cross-shop scrap volume --- */}
        <div className="space-y-4">
          <h3 className="font-[family-name:var(--rb-font-display)] text-lg font-medium">
            {t('disposal.map.title')}
          </h3>
          <DataTable
            rows={scrapMap.data?.map ?? []}
            columns={mapCols}
            rowKey={(r) => `${r.state}:${r.city ?? ''}`}
            empty={t('disposal.map.empty')}
          />
        </div>
      </div>

      {/* --- routes --- */}
      <div className="space-y-4">
        <h3 className="font-[family-name:var(--rb-font-display)] text-lg font-medium">
          {t('disposal.routes.title')}
        </h3>
        <DataTable
          rows={routes.data?.routes ?? []}
          columns={routeCols}
          rowKey={(r) => r.id}
          empty={t('disposal.routes.empty')}
        />
      </div>

      {/* --- selected route --- */}
      {selectedRoute && (
        <div className={panelCls}>
          <div className="flex items-baseline justify-between gap-4 flex-wrap">
            <h3 className="font-[family-name:var(--rb-font-display)] text-lg font-medium">
              {t('disposal.detail.title')}
            </h3>
            <Button type="button" tone="ghost" size="sm" onClick={() => setSelectedRouteId(null)}>
              {t('disposal.detail.close')}
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <StatTile
              label={t('disposal.routes.cols.collected')}
              value={money(selectedRoute.collectedCents)}
            />
            <StatTile
              label={t('disposal.routes.cols.cost')}
              value={money(selectedRoute.haulCostCents)}
            />
            <StatTile
              label={t('disposal.routes.cols.margin')}
              value={selectedRoute.marginCents == null ? '—' : money(selectedRoute.marginCents)}
            />
          </div>

          <DataTable
            rows={routeDetail.data?.hauls ?? []}
            columns={stopCols}
            rowKey={(h) => h.id}
            empty={t('disposal.detail.noStops')}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className={labelCls} htmlFor="route-cost">
                {t('disposal.detail.cost')}
              </label>
              <div className="flex gap-2">
                <input
                  id="route-cost"
                  type="number"
                  min={0}
                  className={fieldCls}
                  value={haulCostCents}
                  onChange={(e) => setHaulCostCents(e.target.value)}
                />
                <Button
                  type="button"
                  tone="secondary"
                  onClick={() => reconcile.mutate()}
                  disabled={reconcile.isPending}
                >
                  {t('disposal.detail.reconcile')}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <span className={labelCls}>{t('disposal.detail.advanceTitle')}</span>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  tone="secondary"
                  size="sm"
                  disabled={selectedRoute.status !== 'scheduled'}
                  onClick={() => advance.mutate('in_transit')}
                >
                  {t('disposal.status.in_transit')}
                </Button>
                <Button
                  type="button"
                  tone="secondary"
                  size="sm"
                  disabled={selectedRoute.status !== 'in_transit'}
                  onClick={() => advance.mutate('completed')}
                >
                  {t('disposal.status.completed')}
                </Button>
                <Button
                  type="button"
                  tone="danger"
                  size="sm"
                  disabled={
                    selectedRoute.status === 'completed' || selectedRoute.status === 'cancelled'
                  }
                  onClick={() => advance.mutate('cancelled')}
                >
                  {t('disposal.status.cancelled')}
                </Button>
              </div>
            </div>
          </div>

          {detailErr && <div className="text-sm text-[var(--rb-alert-red)]">{detailErr}</div>}
          {detailOk && <div className="text-sm text-[var(--rb-alert-green)]">{detailOk}</div>}
        </div>
      )}

      {/* --- directories --- */}
      <div className="space-y-4">
        <h3 className="font-[family-name:var(--rb-font-display)] text-lg font-medium">
          {t('disposal.directories.title')}
        </h3>

        <div className="grid gap-6 lg:grid-cols-2">
          <form
            className={panelCls}
            onSubmit={(e) => {
              e.preventDefault();
              addHauler.mutate();
            }}
          >
            <h4 className="font-medium">{t('disposal.haulers.title')}</h4>
            <p className="text-xs text-[var(--rb-fg-muted)]">{t('disposal.haulers.hint')}</p>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelCls} htmlFor="hauler-name">
                  {t('disposal.haulers.name')}
                </label>
                <input
                  id="hauler-name"
                  className={fieldCls}
                  required
                  minLength={2}
                  value={haulerForm.name}
                  onChange={(e) => setHaulerForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div>
                <label className={labelCls} htmlFor="hauler-state">
                  {t('disposal.haulers.state')}
                </label>
                <input
                  id="hauler-state"
                  className={fieldCls}
                  required
                  maxLength={2}
                  value={haulerForm.state}
                  onChange={(e) => setHaulerForm((f) => ({ ...f, state: e.target.value }))}
                />
              </div>
              <div>
                <label className={labelCls} htmlFor="hauler-permit">
                  {t('disposal.haulers.permit')}
                </label>
                <input
                  id="hauler-permit"
                  className={fieldCls}
                  value={haulerForm.permitNumber}
                  onChange={(e) => setHaulerForm((f) => ({ ...f, permitNumber: e.target.value }))}
                />
              </div>
              <div>
                <label className={labelCls} htmlFor="hauler-capacity">
                  {t('disposal.haulers.capacity')}
                </label>
                <input
                  id="hauler-capacity"
                  type="number"
                  min={1}
                  className={fieldCls}
                  value={haulerForm.truckCapacity}
                  onChange={(e) => setHaulerForm((f) => ({ ...f, truckCapacity: e.target.value }))}
                />
              </div>
              <div>
                <label className={labelCls} htmlFor="hauler-contact">
                  {t('disposal.haulers.contact')}
                </label>
                <input
                  id="hauler-contact"
                  className={fieldCls}
                  value={haulerForm.contactName}
                  onChange={(e) => setHaulerForm((f) => ({ ...f, contactName: e.target.value }))}
                />
              </div>
              <div>
                <label className={labelCls} htmlFor="hauler-phone">
                  {t('disposal.haulers.phone')}
                </label>
                <input
                  id="hauler-phone"
                  className={fieldCls}
                  value={haulerForm.contactPhone}
                  onChange={(e) => setHaulerForm((f) => ({ ...f, contactPhone: e.target.value }))}
                />
              </div>
            </div>

            {haulerErr && <div className="text-sm text-[var(--rb-alert-red)]">{haulerErr}</div>}
            <Button type="submit" tone="secondary" disabled={addHauler.isPending}>
              {t('disposal.haulers.add')}
            </Button>

            <DataTable
              rows={haulers.data?.haulers ?? []}
              columns={haulerCols}
              rowKey={(h) => h.id}
              empty={t('disposal.haulers.empty')}
            />
          </form>

          <form
            className={panelCls}
            onSubmit={(e) => {
              e.preventDefault();
              addFacility.mutate();
            }}
          >
            <h4 className="font-medium">{t('disposal.facilities.title')}</h4>
            <p className="text-xs text-[var(--rb-fg-muted)]">{t('disposal.facilities.hint')}</p>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelCls} htmlFor="facility-name">
                  {t('disposal.facilities.name')}
                </label>
                <input
                  id="facility-name"
                  className={fieldCls}
                  required
                  minLength={2}
                  value={facilityForm.name}
                  onChange={(e) => setFacilityForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div>
                <label className={labelCls} htmlFor="facility-state">
                  {t('disposal.facilities.state')}
                </label>
                <input
                  id="facility-state"
                  className={fieldCls}
                  required
                  maxLength={2}
                  value={facilityForm.state}
                  onChange={(e) => setFacilityForm((f) => ({ ...f, state: e.target.value }))}
                />
              </div>
              <div>
                <label className={labelCls} htmlFor="facility-permit">
                  {t('disposal.facilities.permit')}
                </label>
                <input
                  id="facility-permit"
                  className={fieldCls}
                  value={facilityForm.permitNumber}
                  onChange={(e) =>
                    setFacilityForm((f) => ({ ...f, permitNumber: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className={labelCls} htmlFor="facility-city">
                  {t('disposal.facilities.city')}
                </label>
                <input
                  id="facility-city"
                  className={fieldCls}
                  value={facilityForm.city}
                  onChange={(e) => setFacilityForm((f) => ({ ...f, city: e.target.value }))}
                />
              </div>
            </div>

            {facilityErr && <div className="text-sm text-[var(--rb-alert-red)]">{facilityErr}</div>}
            <Button type="submit" tone="secondary" disabled={addFacility.isPending}>
              {t('disposal.facilities.add')}
            </Button>

            <DataTable
              rows={facilities.data?.facilities ?? []}
              columns={facilityCols}
              rowKey={(f) => f.id}
              empty={t('disposal.facilities.empty')}
            />
          </form>
        </div>
      </div>
    </section>
  );
}
