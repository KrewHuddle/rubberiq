import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button, Card } from '../design/index.js';
import { savePrincipal } from '../principal.js';

export function SignInPage() {
  const { t } = useTranslation('auth');
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [shopSlug, setShopSlug] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password, shopSlug: shopSlug || undefined }),
      });
      if (!res.ok) {
        setError(t('invalidCredentials'));
        return;
      }
      const body = (await res.json()) as {
        token: string;
        principal: { kind: 'user' | 'platform'; role: string; shopId?: string };
      };
      savePrincipal(body.token, body.principal as never);
      nav('/');
    } catch {
      setError(t('invalidCredentials'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-dvh grid place-items-center px-6">
      <Card elev="raised" className="w-full max-w-md">
        <h1 className="font-[family-name:var(--rb-font-display)] text-3xl font-semibold tracking-tight mb-6">
          {t('signIn')}
        </h1>
        <form onSubmit={submit} className="space-y-4">
          <Field label={t('shopSlug')} value={shopSlug} onChange={setShopSlug} autoComplete="organization" />
          <Field
            label={t('email')}
            value={email}
            onChange={setEmail}
            type="email"
            autoComplete="email"
            required
          />
          <Field
            label={t('password')}
            value={password}
            onChange={setPassword}
            type="password"
            autoComplete="current-password"
            required
          />
          {error && <div className="text-sm text-[var(--rb-alert-red)]">{error}</div>}
          <Button type="submit" tone="primary" size="lg" disabled={submitting} className="w-full">
            {t('signIn')}
          </Button>
          <p className="text-xs text-[var(--rb-fg-subtle)] text-center">
            {shopSlug ? t('shopLogin') : t('platformLogin')}
          </p>
        </form>
      </Card>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  required,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium uppercase tracking-wider text-[var(--rb-fg-muted)] mb-1">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        autoComplete={autoComplete}
        className="w-full h-11 px-3 rounded-[var(--rb-radius-md)] bg-[var(--rb-bg)] border border-[var(--rb-border)] text-[var(--rb-fg)] focus:outline-none focus:border-[var(--rb-border-strong)] focus:ring-2 focus:ring-[var(--rb-ring)]"
      />
    </label>
  );
}
