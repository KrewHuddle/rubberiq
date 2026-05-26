/**
 * Intake page — Phase 1.
 *
 * Flow:
 *   1. CameraCapture (or file upload) produces a JPEG data URL.
 *   2. POST /api/tires/intake/photo runs the vision pipeline server-side.
 *   3. Response renders IntakeRevealCard with the AI "wow" moment.
 *   4. Worker confirms → /api/tires/intake/confirm.
 *   5. FAIL → tire was already auto-routed to scrap; show fail message.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  IntakeRevealCard,
  type IntakeRevealData,
  type Grade,
} from '../design/index.js';
import { CameraCapture } from '../components/CameraCapture.js';
import { api, ApiError } from '../lib/api.js';

type IntakeResult = {
  tireId: string;
  status: 'intake_review' | 'in_stock' | 'rejected';
  grade: Grade;
  priceCents: number | null;
  ageMonths: number | null;
  treadDepth32nds: number | null;
  benchmarkCents: number | null;
  vision: {
    brand: string | null;
    model: string | null;
    size: string | null;
    dotCode: string | null;
    treadDepth32nds: number | null;
    confidence: number;
  };
  reasons: {
    lowConfidence: boolean;
    failed: boolean;
    sizeUnparsed: boolean;
    dotUnparsed: boolean;
  };
};

export function IntakePage() {
  const { t, i18n } = useTranslation('intake');
  const [photo, setPhoto] = useState<string | null>(null);
  const [result, setResult] = useState<IntakeResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onCapture = async (dataUrl: string) => {
    setPhoto(dataUrl);
    setError(null);
    setSubmitting(true);
    try {
      const res = await api<IntakeResult>('/api/tires/intake/photo', {
        method: 'POST',
        body: JSON.stringify({
          photoDataUrl: dataUrl,
          language: i18n.language === 'es' ? 'es' : 'en',
        }),
      });
      setResult(res);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'intake_failed';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const confirm = async () => {
    if (!result) return;
    setSubmitting(true);
    try {
      await api('/api/tires/intake/confirm', {
        method: 'POST',
        body: JSON.stringify({ tireId: result.tireId }),
      });
      reset();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'confirm_failed');
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setPhoto(null);
    setResult(null);
    setError(null);
  };

  const revealData: IntakeRevealData | null = result
    ? {
        brand: result.vision.brand,
        model: result.vision.model,
        size: result.vision.size ?? '—',
        dotCode: result.vision.dotCode,
        ageMonths: result.ageMonths,
        treadDepth32nds: result.treadDepth32nds,
        grade: result.grade,
        priceCents: result.priceCents ?? 0,
        benchmarkCents: result.benchmarkCents,
        language: i18n.language,
      }
    : null;

  return (
    <div className="space-y-10">
      <header>
        <h1 className="font-[family-name:var(--rb-font-display)] text-5xl font-semibold tracking-tight">
          {t('title')}
        </h1>
        <p className="mt-2 text-[var(--rb-fg-muted)] text-lg">{t('subtitle')}</p>
      </header>

      {!photo && !result && (
        <CameraCapture
          onCapture={onCapture}
          labels={{
            capture: t('actions.capture'),
            retake: t('actions.retake'),
            useFile: t('actions.useFile'),
          }}
        />
      )}

      {submitting && !result && (
        <div className="text-center text-[var(--rb-fg-muted)] py-8">…</div>
      )}

      {error && <div className="text-sm text-[var(--rb-alert-red)]">{error}</div>}

      {revealData && (
        <>
          <IntakeRevealCard
            data={revealData}
            labels={{
              size: t('fields.size'),
              dot: t('fields.dot'),
              age: t('fields.age'),
              tread: t('fields.tread'),
              ageUnit: ` ${t('units.ageMonths')}`,
              treadUnit: t('units.tread32'),
            }}
          />

          {result?.reasons.failed && (
            <div className="rounded-[var(--rb-radius-md)] border border-[var(--rb-alert-red)] bg-[color-mix(in_oklch,var(--rb-alert-red)_10%,transparent)] p-4 text-[var(--rb-alert-red)]">
              {t('failBlock')}
            </div>
          )}
          {result?.reasons.lowConfidence && !result.reasons.failed && (
            <div className="rounded-[var(--rb-radius-md)] border border-[var(--rb-border)] bg-[var(--rb-bg-sunk)] p-4 text-[var(--rb-fg-muted)]">
              {t('lowConfidence')}
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <Button size="lg" onClick={reset} tone="secondary">
              {t('actions.retake')}
            </Button>
            {!result?.reasons.failed && (
              <Button size="lg" onClick={confirm} disabled={submitting}>
                {t('actions.confirm')}
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
