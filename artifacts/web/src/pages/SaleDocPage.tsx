/**
 * SaleDocPage (Module 11) — render server-generated HTML doc in iframe +
 * capture customer signature on canvas, post back to /sale-docs/:id/sign.
 *
 * URL: /sale-doc/:id  (shop-scoped via session token)
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card } from '../design/index.js';
import { api, ApiError } from '../lib/api.js';
import { loadToken } from '../principal.js';

type SaleDoc = {
  id: string;
  invoiceId: string;
  tireId: string;
  language: 'en' | 'es';
  ageDisclosureRequired: boolean;
  customerSignatureUrl: string | null;
  signedAt: string | null;
};

export function SaleDocPage() {
  const { id = '' } = useParams<{ id: string }>();
  const { t } = useTranslation('dashboard');
  const qc = useQueryClient();

  const doc = useQuery<{ saleDoc: SaleDoc }>({
    queryKey: ['sale-doc', id],
    queryFn: () => api(`/api/shop/sale-docs/${id}`),
    enabled: !!id,
  });

  // HTML iframe — fetch the rendered doc as blob so we can carry the auth header,
  // then point the iframe at the resulting object URL.
  const [docUrl, setDocUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!id) return;
    let revoked = false;
    let objectUrl: string | null = null;
    void (async () => {
      const token = loadToken();
      const res = await fetch(`/api/shop/sale-docs/${id}/html`, {
        headers: token ? { authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) return;
      const blob = await res.blob();
      if (revoked) return;
      objectUrl = URL.createObjectURL(blob);
      setDocUrl(objectUrl);
    })();
    return () => {
      revoked = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id, doc.data?.saleDoc.signedAt]);

  return (
    <div className="grid gap-6 lg:grid-cols-[1.7fr_1fr]">
      <Card className="p-0 overflow-hidden">
        {docUrl ? (
          <iframe
            title="sale-doc"
            src={docUrl}
            className="w-full h-[80vh] bg-white"
          />
        ) : (
          <div className="p-12 text-center text-[var(--rb-fg-muted)]">
            {t('saleDoc.loading', 'Loading document…')}
          </div>
        )}
      </Card>

      <div className="space-y-4">
        <Card>
          <h2 className="font-[family-name:var(--rb-font-display)] text-xl font-semibold mb-2">
            {t('saleDoc.sign', 'Customer signature')}
          </h2>
          {doc.data?.saleDoc.signedAt ? (
            <div>
              <div className="text-sm text-[var(--rb-alert-green)] mb-2">
                ✓ {t('saleDoc.signed', 'Signed')} ·{' '}
                {new Date(doc.data.saleDoc.signedAt).toLocaleString()}
              </div>
              {doc.data.saleDoc.customerSignatureUrl && (
                <img
                  src={doc.data.saleDoc.customerSignatureUrl}
                  alt="signature"
                  className="max-h-32 border border-[var(--rb-border)] rounded-[var(--rb-radius-sm)] bg-white p-2"
                />
              )}
            </div>
          ) : (
            <SignaturePad
              saleDocId={id}
              onSigned={() => {
                void qc.invalidateQueries({ queryKey: ['sale-doc', id] });
              }}
            />
          )}
        </Card>

        {doc.data?.saleDoc.ageDisclosureRequired && !doc.data.saleDoc.signedAt && (
          <Card className="border-[var(--rb-alert-yellow)]">
            <div className="text-xs font-mono uppercase tracking-wider text-[oklch(28%_0.08_85)] mb-2">
              {t('saleDoc.ageDisclosure', 'Age disclosure required')}
            </div>
            <div className="text-sm text-[var(--rb-fg-muted)]">
              {t(
                'saleDoc.ageDisclosureBody',
                'Customer must acknowledge tire age before signing.',
              )}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

/** Inline signature pad — canvas pointer events, no library. */
function SignaturePad({ saleDocId, onSigned }: { saleDocId: string; onSigned: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasInk, setHasInk] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const ctxRef = useMemo(
    () =>
      ({
        get current(): CanvasRenderingContext2D | null {
          return ref.current?.getContext('2d') ?? null;
        },
      }) as { readonly current: CanvasRenderingContext2D | null },
    [],
  );

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    // High-DPI: size the backing store to devicePixelRatio.
    const dpr = window.devicePixelRatio || 1;
    const rect = c.getBoundingClientRect();
    c.width = rect.width * dpr;
    c.height = rect.height * dpr;
    const ctx = c.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#111';
    }
  }, []);

  const pointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const submit = useMutation({
    mutationFn: async () => {
      const c = ref.current;
      if (!c) throw new Error('canvas_missing');
      const dataUrl = c.toDataURL('image/png');
      await api(`/api/shop/sale-docs/${saleDocId}/sign`, {
        method: 'POST',
        body: JSON.stringify({ signatureDataUrl: dataUrl }),
      });
    },
    onSuccess: () => {
      setHasInk(false);
      onSigned();
    },
    onError: (e: unknown) => setErr(e instanceof ApiError ? e.message : 'failed'),
  });

  return (
    <div>
      <canvas
        ref={ref}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          drawing.current = true;
          const { x, y } = pointer(e);
          ctxRef.current?.beginPath();
          ctxRef.current?.moveTo(x, y);
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return;
          const { x, y } = pointer(e);
          ctxRef.current?.lineTo(x, y);
          ctxRef.current?.stroke();
          if (!hasInk) setHasInk(true);
        }}
        onPointerUp={() => {
          drawing.current = false;
        }}
        className="w-full h-32 rounded-[var(--rb-radius-sm)] border border-[var(--rb-border)] bg-white touch-none"
      />
      <div className="mt-3 flex gap-2">
        <Button
          tone="secondary"
          size="sm"
          onClick={() => {
            const c = ref.current;
            if (c) {
              const ctx = c.getContext('2d');
              ctx?.clearRect(0, 0, c.width, c.height);
            }
            setHasInk(false);
          }}
        >
          Clear
        </Button>
        <Button
          tone="primary"
          size="sm"
          disabled={!hasInk || submit.isPending}
          onClick={() => submit.mutate()}
        >
          {submit.isPending ? 'Submitting…' : 'Submit signature'}
        </Button>
      </div>
      {err && <div className="mt-2 text-xs text-[var(--rb-alert-red)]">{err}</div>}
    </div>
  );
}
