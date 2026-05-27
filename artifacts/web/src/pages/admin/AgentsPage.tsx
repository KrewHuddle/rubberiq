/**
 * Admin agents — list + create form + assign-shop form.
 *
 * Temp password is shown ONCE on create. Caller must copy + relay OOB.
 */
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, DataTable, type Column } from '../../design/index.js';
import { api, ApiError } from '../../lib/api.js';

type Agent = {
  id: string;
  platformUserId: string;
  name: string;
  territory: string | null;
  commissionPlanId: string | null;
  createdAt: string;
};

type Plan = { id: string; name: string };
type Shop = { id: string; name: string; slug: string };

type CreateResp = {
  agentId: string;
  platformUserId: string;
  tempPassword: string;
  created: boolean;
};

export function AgentsPage() {
  const { t, i18n } = useTranslation('admin');
  const qc = useQueryClient();

  const agents = useQuery<{ agents: Agent[] }>({
    queryKey: ['admin', 'agents'],
    queryFn: () => api('/api/admin/agents'),
  });
  const plans = useQuery<{ plans: Plan[] }>({
    queryKey: ['admin', 'commission-plans'],
    queryFn: () => api('/api/admin/commission-plans'),
  });
  const shops = useQuery<{ shops: Shop[] }>({
    queryKey: ['admin', 'shops'],
    queryFn: () => api('/api/admin/shops'),
  });

  /* ---------- create agent ---------- */
  const [form, setForm] = useState({ name: '', email: '', territory: '', commissionPlanId: '' });
  const [tempPw, setTempPw] = useState<string | null>(null);
  const [pwCopied, setPwCopied] = useState(false);
  const [createErr, setCreateErr] = useState<string | null>(null);

  const createAgent = useMutation<CreateResp, ApiError, void>({
    mutationFn: () =>
      api<CreateResp>('/api/admin/agents', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          territory: form.territory || undefined,
          commissionPlanId: form.commissionPlanId || undefined,
        }),
      }),
    onSuccess: (data) => {
      setTempPw(data.tempPassword);
      setForm({ name: '', email: '', territory: '', commissionPlanId: '' });
      setCreateErr(null);
      void qc.invalidateQueries({ queryKey: ['admin', 'agents'] });
    },
    onError: (e) => {
      if (e.message === 'email_taken_by_non_agent') setCreateErr(t('agents.emailTaken'));
      else setCreateErr(e.message);
    },
  });

  /* ---------- assign shop ---------- */
  const [assign, setAssign] = useState({ agentId: '', shopId: '' });
  const [assignErr, setAssignErr] = useState<string | null>(null);
  const [assignOk, setAssignOk] = useState(false);

  const assignShop = useMutation<unknown, ApiError, void>({
    mutationFn: () =>
      api(`/api/admin/agents/${assign.agentId}/assign`, {
        method: 'POST',
        body: JSON.stringify({ shopId: assign.shopId }),
      }),
    onSuccess: () => {
      setAssignOk(true);
      setAssignErr(null);
      void qc.invalidateQueries({ queryKey: ['admin', 'agents'] });
      void qc.invalidateQueries({ queryKey: ['admin', 'shops'] });
    },
    onError: (e) => {
      setAssignOk(false);
      if (e.message === 'shop_already_attributed') setAssignErr(t('agents.alreadyAttributed'));
      else setAssignErr(e.message);
    },
  });

  const onSubmitAgent = (e: FormEvent) => {
    e.preventDefault();
    createAgent.mutate();
  };

  const onSubmitAssign = (e: FormEvent) => {
    e.preventDefault();
    assignShop.mutate();
  };

  const copyPw = async () => {
    if (!tempPw) return;
    try {
      await navigator.clipboard.writeText(tempPw);
      setPwCopied(true);
      setTimeout(() => setPwCopied(false), 1800);
    } catch {
      /* ignore */
    }
  };

  const fmtDate = (iso: string) =>
    new Intl.DateTimeFormat(i18n.language, { year: 'numeric', month: 'short', day: 'numeric' }).format(
      new Date(iso),
    );

  const columns: Column<Agent>[] = [
    { key: 'name', header: t('agents.cols.name'), cell: (a) => a.name },
    {
      key: 'territory',
      header: t('agents.cols.territory'),
      cell: (a) => a.territory ?? '—',
    },
    {
      key: 'created',
      header: t('agents.cols.created'),
      cell: (a) => fmtDate(a.createdAt),
      mono: true,
      align: 'right',
    },
  ];

  const fieldCls =
    'w-full rounded-[var(--rb-radius-sm)] border border-[var(--rb-border)] bg-[var(--rb-bg-elev)] px-3 py-2 text-sm focus:outline-none focus:border-[var(--rb-border-strong)] focus:ring-2 focus:ring-[var(--rb-ring)]';
  const labelCls = 'block text-xs uppercase tracking-wider text-[var(--rb-fg-muted)] mb-1';

  return (
    <section className="space-y-8">
      <h2 className="font-[family-name:var(--rb-font-display)] text-2xl font-semibold tracking-tight">
        {t('agents.title')}
      </h2>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* --- create form --- */}
        <form
          onSubmit={onSubmitAgent}
          className="space-y-4 rounded-[var(--rb-radius-lg)] border border-[var(--rb-border)] bg-[var(--rb-bg-elev)] p-5"
        >
          <h3 className="font-[family-name:var(--rb-font-display)] text-lg font-medium">
            {t('agents.newAgent')}
          </h3>

          <div>
            <label className={labelCls} htmlFor="agent-name">
              {t('agents.name')}
            </label>
            <input
              id="agent-name"
              className={fieldCls}
              value={form.name}
              required
              minLength={2}
              maxLength={120}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="agent-email">
              {t('agents.email')}
            </label>
            <input
              id="agent-email"
              type="email"
              className={fieldCls}
              value={form.email}
              required
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="agent-territory">
              {t('agents.territory')}
            </label>
            <input
              id="agent-territory"
              className={fieldCls}
              value={form.territory}
              maxLength={120}
              onChange={(e) => setForm((f) => ({ ...f, territory: e.target.value }))}
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="agent-plan">
              {t('agents.plan')}
            </label>
            <select
              id="agent-plan"
              className={fieldCls}
              value={form.commissionPlanId}
              onChange={(e) => setForm((f) => ({ ...f, commissionPlanId: e.target.value }))}
            >
              <option value="">{t('agents.noPlan')}</option>
              {plans.data?.plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {createErr && (
            <div className="text-sm text-[var(--rb-alert-red)]">{createErr}</div>
          )}

          <Button type="submit" disabled={createAgent.isPending}>
            {t('agents.create')}
          </Button>

          {tempPw && (
            <div className="rounded-[var(--rb-radius-md)] border border-[var(--rb-accent)] bg-[color-mix(in_oklch,var(--rb-accent)_10%,transparent)] p-4 space-y-2">
              <div className="text-sm">{t('agents.createdToast')}</div>
              <div className="text-xs uppercase tracking-wider text-[var(--rb-fg-muted)]">
                {t('agents.tempPassword')}
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 rb-mono text-sm break-all rounded-[var(--rb-radius-sm)] bg-[var(--rb-bg-sunk)] px-3 py-2">
                  {tempPw}
                </code>
                <Button type="button" tone="secondary" size="sm" onClick={copyPw}>
                  {pwCopied ? t('agents.copied') : t('agents.copy')}
                </Button>
                <Button
                  type="button"
                  tone="ghost"
                  size="sm"
                  onClick={() => {
                    setTempPw(null);
                    setPwCopied(false);
                  }}
                >
                  {t('agents.dismiss')}
                </Button>
              </div>
            </div>
          )}
        </form>

        {/* --- assign-shop form --- */}
        <form
          onSubmit={onSubmitAssign}
          className="space-y-4 rounded-[var(--rb-radius-lg)] border border-[var(--rb-border)] bg-[var(--rb-bg-elev)] p-5"
        >
          <h3 className="font-[family-name:var(--rb-font-display)] text-lg font-medium">
            {t('agents.assignTitle')}
          </h3>
          <div>
            <label className={labelCls} htmlFor="assign-agent">
              {t('agents.selectAgent')}
            </label>
            <select
              id="assign-agent"
              className={fieldCls}
              required
              value={assign.agentId}
              onChange={(e) => setAssign((a) => ({ ...a, agentId: e.target.value }))}
            >
              <option value="">—</option>
              {agents.data?.agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor="assign-shop">
              {t('agents.selectShop')}
            </label>
            <select
              id="assign-shop"
              className={fieldCls}
              required
              value={assign.shopId}
              onChange={(e) => setAssign((a) => ({ ...a, shopId: e.target.value }))}
            >
              <option value="">—</option>
              {shops.data?.shops.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.slug})
                </option>
              ))}
            </select>
          </div>

          {assignErr && <div className="text-sm text-[var(--rb-alert-red)]">{assignErr}</div>}
          {assignOk && (
            <div className="text-sm text-[var(--rb-alert-green)]">{t('agents.assigned')}</div>
          )}

          <Button type="submit" tone="secondary" disabled={assignShop.isPending}>
            {t('agents.assign')}
          </Button>
        </form>
      </div>

      <DataTable
        rows={agents.data?.agents ?? []}
        columns={columns}
        rowKey={(a) => a.id}
        empty={t('agents.empty')}
      />
    </section>
  );
}
