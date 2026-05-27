/**
 * Admin commission plans — list + create.
 *
 * Plan shape (mirrors api-server/src/routes/admin.ts CreateCommissionPlanBody):
 *   signupRate: { kind:'flat', amountCents } | { kind:'percent', bps, ofMonths }
 *   residualRateBps, residualTerm: 'life' | 'N', upsellRateBps, upsellAttribution
 */
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, DataTable, Badge, type Column } from '../../design/index.js';
import { api, ApiError } from '../../lib/api.js';

type SignupRate =
  | { kind: 'flat'; amountCents: number }
  | { kind: 'percent'; bps: number; ofMonths: number };

type Plan = {
  id: string;
  name: string;
  signupRate: SignupRate;
  residualRateBps: number;
  residualTerm: string; // 'life' or integer string
  upsellRateBps: number;
  upsellAttribution: string;
  createdAt: string;
};

export function CommissionPlansPage() {
  const { t, i18n } = useTranslation('admin');
  const qc = useQueryClient();

  const plans = useQuery<{ plans: Plan[] }>({
    queryKey: ['admin', 'commission-plans'],
    queryFn: () => api('/api/admin/commission-plans'),
  });

  const [kind, setKind] = useState<'flat' | 'percent'>('percent');
  const [form, setForm] = useState({
    name: '',
    flatAmountCents: 50_000, // $500
    percentBps: 1_000, // 10%
    ofMonths: 1,
    residualRateBps: 1_000, // 10% of monthly
    residualTerm: 'life',
    residualMonths: 12,
    upsellRateBps: 1_000,
    upsellAttribution: 'upseller' as 'upseller' | 'signer' | 'split',
  });
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState(false);

  const create = useMutation<unknown, ApiError, void>({
    mutationFn: () => {
      const signupRate =
        kind === 'flat'
          ? { kind: 'flat' as const, amountCents: Number(form.flatAmountCents) }
          : {
              kind: 'percent' as const,
              bps: Number(form.percentBps),
              ofMonths: Number(form.ofMonths),
            };
      const residualTerm =
        form.residualTerm === 'life' ? 'life' : String(Number(form.residualMonths));
      return api('/api/admin/commission-plans', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name,
          signupRate,
          residualRateBps: Number(form.residualRateBps),
          residualTerm,
          upsellRateBps: Number(form.upsellRateBps),
          upsellAttribution: form.upsellAttribution,
        }),
      });
    },
    onSuccess: () => {
      setOkMsg(true);
      setErr(null);
      setForm((f) => ({ ...f, name: '' }));
      void qc.invalidateQueries({ queryKey: ['admin', 'commission-plans'] });
      setTimeout(() => setOkMsg(false), 2000);
    },
    onError: (e) => {
      setOkMsg(false);
      setErr(e.message);
    },
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    create.mutate();
  };

  const fmtBps = (bps: number) => `${(bps / 100).toFixed(2)}%`;
  const fmtUsdCents = (cents: number) =>
    new Intl.NumberFormat(i18n.language === 'es' ? 'es-US' : 'en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(cents / 100);
  const fmtDate = (iso: string) =>
    new Intl.DateTimeFormat(i18n.language, { year: 'numeric', month: 'short', day: 'numeric' }).format(
      new Date(iso),
    );

  const columns: Column<Plan>[] = [
    { key: 'name', header: t('plans.cols.name'), cell: (p) => p.name },
    {
      key: 'signup',
      header: t('plans.cols.signup'),
      cell: (p) =>
        p.signupRate.kind === 'flat'
          ? fmtUsdCents(p.signupRate.amountCents)
          : `${fmtBps(p.signupRate.bps)} × ${p.signupRate.ofMonths}mo`,
      mono: true,
    },
    {
      key: 'residual',
      header: t('plans.cols.residual'),
      cell: (p) => fmtBps(p.residualRateBps),
      mono: true,
      align: 'right',
    },
    {
      key: 'upsell',
      header: t('plans.cols.upsell'),
      cell: (p) => (
        <div className="flex items-center gap-2 justify-end">
          <span className="rb-mono">{fmtBps(p.upsellRateBps)}</span>
          <Badge tone="neutral">{p.upsellAttribution}</Badge>
        </div>
      ),
      align: 'right',
    },
    {
      key: 'term',
      header: t('plans.cols.term'),
      cell: (p) =>
        p.residualTerm === 'life'
          ? t('plans.termLife')
          : `${p.residualTerm} ${t('plans.termMonths')}`,
      align: 'center',
    },
    {
      key: 'created',
      header: t('plans.cols.created'),
      cell: (p) => fmtDate(p.createdAt),
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
        {t('plans.title')}
      </h2>

      <form
        onSubmit={onSubmit}
        className="space-y-4 rounded-[var(--rb-radius-lg)] border border-[var(--rb-border)] bg-[var(--rb-bg-elev)] p-5"
      >
        <h3 className="font-[family-name:var(--rb-font-display)] text-lg font-medium">
          {t('plans.newPlan')}
        </h3>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className={labelCls} htmlFor="plan-name">
              {t('plans.name')}
            </label>
            <input
              id="plan-name"
              className={fieldCls}
              required
              minLength={2}
              maxLength={120}
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>

          <div className="md:col-span-2">
            <label className={labelCls}>{t('plans.signupKind')}</label>
            <div className="flex gap-2">
              <Button
                type="button"
                tone={kind === 'flat' ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setKind('flat')}
              >
                {t('plans.kindFlat')}
              </Button>
              <Button
                type="button"
                tone={kind === 'percent' ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setKind('percent')}
              >
                {t('plans.kindPercent')}
              </Button>
            </div>
          </div>

          {kind === 'flat' ? (
            <div>
              <label className={labelCls} htmlFor="plan-flat">
                {t('plans.flatAmount')}
              </label>
              <input
                id="plan-flat"
                type="number"
                min={0}
                className={fieldCls}
                value={form.flatAmountCents}
                onChange={(e) =>
                  setForm((f) => ({ ...f, flatAmountCents: Number(e.target.value) }))
                }
              />
            </div>
          ) : (
            <>
              <div>
                <label className={labelCls} htmlFor="plan-bps">
                  {t('plans.percentBps')}
                </label>
                <input
                  id="plan-bps"
                  type="number"
                  min={0}
                  max={20_000}
                  className={fieldCls}
                  value={form.percentBps}
                  onChange={(e) => setForm((f) => ({ ...f, percentBps: Number(e.target.value) }))}
                />
              </div>
              <div>
                <label className={labelCls} htmlFor="plan-months">
                  {t('plans.ofMonths')}
                </label>
                <input
                  id="plan-months"
                  type="number"
                  min={1}
                  max={36}
                  className={fieldCls}
                  value={form.ofMonths}
                  onChange={(e) => setForm((f) => ({ ...f, ofMonths: Number(e.target.value) }))}
                />
              </div>
            </>
          )}

          <div>
            <label className={labelCls} htmlFor="plan-residual">
              {t('plans.residualBps')}
            </label>
            <input
              id="plan-residual"
              type="number"
              min={0}
              max={10_000}
              className={fieldCls}
              value={form.residualRateBps}
              onChange={(e) =>
                setForm((f) => ({ ...f, residualRateBps: Number(e.target.value) }))
              }
            />
          </div>

          <div>
            <label className={labelCls} htmlFor="plan-term">
              {t('plans.residualTerm')}
            </label>
            <div className="flex gap-2">
              <select
                id="plan-term"
                className={fieldCls}
                value={form.residualTerm}
                onChange={(e) => setForm((f) => ({ ...f, residualTerm: e.target.value }))}
              >
                <option value="life">{t('plans.termLife')}</option>
                <option value="months">{t('plans.termMonths')}</option>
              </select>
              {form.residualTerm === 'months' && (
                <input
                  type="number"
                  min={1}
                  max={120}
                  className={fieldCls}
                  value={form.residualMonths}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, residualMonths: Number(e.target.value) }))
                  }
                />
              )}
            </div>
          </div>

          <div>
            <label className={labelCls} htmlFor="plan-upsell">
              {t('plans.upsellBps')}
            </label>
            <input
              id="plan-upsell"
              type="number"
              min={0}
              max={10_000}
              className={fieldCls}
              value={form.upsellRateBps}
              onChange={(e) => setForm((f) => ({ ...f, upsellRateBps: Number(e.target.value) }))}
            />
          </div>

          <div>
            <label className={labelCls} htmlFor="plan-attr">
              {t('plans.attribution')}
            </label>
            <select
              id="plan-attr"
              className={fieldCls}
              value={form.upsellAttribution}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  upsellAttribution: e.target.value as 'upseller' | 'signer' | 'split',
                }))
              }
            >
              <option value="upseller">{t('plans.attrUpseller')}</option>
              <option value="signer">{t('plans.attrSigner')}</option>
              <option value="split">{t('plans.attrSplit')}</option>
            </select>
          </div>
        </div>

        {err && <div className="text-sm text-[var(--rb-alert-red)]">{err}</div>}
        {okMsg && <div className="text-sm text-[var(--rb-alert-green)]">{t('plans.created')}</div>}

        <Button type="submit" disabled={create.isPending}>
          {t('plans.create')}
        </Button>
      </form>

      <DataTable
        rows={plans.data?.plans ?? []}
        columns={columns}
        rowKey={(p) => p.id}
        empty={t('plans.empty')}
      />
    </section>
  );
}
