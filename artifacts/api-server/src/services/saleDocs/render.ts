/**
 * Sale-doc HTML renderer. Returns a self-contained HTML string the customer
 * can read on a tablet at the counter (and the shop can print to paper).
 *
 * Pulls all related rows in one read, then formats with the requested language.
 * Trade-secret grading constants are NOT exposed — only the resulting grade.
 */
import { eq } from 'drizzle-orm';
import { getDb, schema } from '@rubberiq/db';

type RenderInput = {
  saleDocId: string;
  language?: 'en' | 'es';
};

const COPY = {
  en: {
    title: 'Used-Tire Sale Disclosure',
    shop: 'Selling shop',
    customer: 'Customer',
    invoice: 'Invoice',
    tire: 'Tire',
    size: 'Size',
    dot: 'DOT code',
    age: 'Age',
    grade: 'Grade',
    tread: 'Tread (photo)',
    sidewall: 'Sidewall (photo)',
    months: 'months',
    noPhoto: 'Photo on file — server copy',
    disclosureTitle: 'AGE DISCLOSURE — please read',
    disclosureBody:
      'The tire below is older than the recommended threshold. By signing, you acknowledge you have been informed of its age and grade and accept it in its current condition.',
    signatureLabel: 'Customer signature',
    signedAt: 'Signed',
    notSigned: 'Awaiting signature',
    footer:
      'This record is retained by the shop for a minimum of 3 years per applicable state regulations.',
  },
  es: {
    title: 'Divulgación de Venta de Llanta Usada',
    shop: 'Taller vendedor',
    customer: 'Cliente',
    invoice: 'Factura',
    tire: 'Llanta',
    size: 'Medida',
    dot: 'Código DOT',
    age: 'Antigüedad',
    grade: 'Calificación',
    tread: 'Banda de rodadura (foto)',
    sidewall: 'Flanco (foto)',
    months: 'meses',
    noPhoto: 'Foto en archivo — copia en servidor',
    disclosureTitle: 'AVISO DE ANTIGÜEDAD — favor de leer',
    disclosureBody:
      'La llanta a continuación supera el umbral recomendado de antigüedad. Al firmar, usted reconoce que ha sido informado de su edad y calificación y la acepta en su condición actual.',
    signatureLabel: 'Firma del cliente',
    signedAt: 'Firmado',
    notSigned: 'Pendiente de firma',
    footer:
      'Este registro es retenido por el taller por un mínimo de 3 años conforme a las regulaciones estatales aplicables.',
  },
} as const;

function esc(s: string | null | undefined): string {
  if (s == null) return '';
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function renderSaleDoc(input: RenderInput): Promise<{
  html: string;
  language: 'en' | 'es';
  saleDocId: string;
}> {
  const db = getDb();

  const doc = await db.query.saleDocs.findFirst({
    where: eq(schema.saleDocs.id, input.saleDocId),
  });
  if (!doc) throw new Error(`sale_doc_not_found:${input.saleDocId}`);

  const [tire, invoice] = await Promise.all([
    db.query.tires.findFirst({ where: eq(schema.tires.id, doc.tireId) }),
    db.query.invoices.findFirst({
      where: eq(schema.invoices.id, doc.invoiceId),
      with: { customer: true },
    }),
  ]);
  if (!tire || invoice == null) throw new Error('sale_doc_orphaned');

  const shop = await db.query.shops.findFirst({ where: eq(schema.shops.id, invoice.shopId) });
  if (!shop) throw new Error('shop_not_found');

  const lang: 'en' | 'es' =
    input.language ?? (doc.language === 'es' ? 'es' : 'en');
  const c = COPY[lang];

  const photoCard = (label: string, url: string | null | undefined): string => `
    <figure class="photo">
      <figcaption>${esc(label)}</figcaption>
      ${
        url
          ? `<img src="${esc(url)}" alt="${esc(label)}" />`
          : `<div class="photo__placeholder">${esc(c.noPhoto)}</div>`
      }
    </figure>
  `;

  const html = `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(c.title)} — ${esc(shop.name)}</title>
<style>
  :root { color-scheme: light; }
  body {
    margin: 0;
    font-family: "IBM Plex Sans", system-ui, sans-serif;
    color: oklch(20% 0.015 60);
    background: oklch(98% 0.003 95);
    -webkit-font-smoothing: antialiased;
  }
  .doc { max-width: 760px; margin: 0 auto; padding: 32px 24px; }
  .h { font-family: "Space Grotesk", "IBM Plex Sans", sans-serif; letter-spacing: -0.02em; }
  h1 { font-size: 28px; margin: 0 0 4px; }
  h2 { font-size: 14px; text-transform: uppercase; letter-spacing: 0.14em; margin: 24px 0 12px; color: oklch(45% 0.012 60); }
  .sub { color: oklch(45% 0.012 60); font-size: 13px; margin: 0 0 24px; }
  .row { display: grid; grid-template-columns: 160px 1fr; gap: 8px 16px; padding: 8px 0; border-bottom: 1px solid oklch(88% 0.005 95); font-size: 14px; }
  .row b { font-weight: 500; color: oklch(45% 0.012 60); text-transform: uppercase; letter-spacing: 0.04em; font-size: 11px; }
  .grade { display: inline-grid; place-items: center; width: 2em; height: 2em; background: oklch(64% 0.18 38); color: oklch(98% 0.003 95); border-radius: 4px; font-weight: 700; font-family: "Space Grotesk", sans-serif; }
  .photos { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 12px 0 24px; }
  .photo { margin: 0; border: 1px solid oklch(88% 0.005 95); border-radius: 4px; overflow: hidden; background: oklch(95% 0.005 95); }
  .photo figcaption { padding: 8px 12px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: oklch(45% 0.012 60); border-bottom: 1px solid oklch(88% 0.005 95); background: white; }
  .photo img { display: block; width: 100%; height: auto; }
  .photo__placeholder { padding: 28px 12px; text-align: center; font-size: 12px; color: oklch(58% 0.008 60); }
  .disclosure { border: 2px solid oklch(58% 0.20 38); background: color-mix(in oklch, oklch(64% 0.18 38) 8%, white); padding: 16px 18px; border-radius: 6px; margin: 24px 0; }
  .disclosure b { display: block; font-family: "Space Grotesk", sans-serif; font-size: 13px; letter-spacing: 0.14em; text-transform: uppercase; color: oklch(58% 0.20 38); margin-bottom: 6px; }
  .signature { margin-top: 32px; padding-top: 16px; border-top: 2px solid oklch(20% 0.015 60); }
  .signature b { display: block; font-size: 11px; text-transform: uppercase; letter-spacing: 0.14em; color: oklch(45% 0.012 60); margin-bottom: 8px; }
  .signature img { max-width: 320px; max-height: 96px; }
  .signature .pending { color: oklch(58% 0.008 60); font-style: italic; font-size: 13px; }
  footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid oklch(88% 0.005 95); font-size: 11px; color: oklch(58% 0.008 60); }
  @media print { body { background: white; } .doc { padding: 0; max-width: none; } }
</style>
</head>
<body>
<div class="doc">
  <header>
    <h1 class="h">${esc(c.title)}</h1>
    <p class="sub">${esc(shop.name)} · ${esc(shop.city ?? '')} ${esc(shop.state)}</p>
  </header>

  <section>
    <h2>${esc(c.invoice)} · ${esc(c.tire)}</h2>
    <div class="row"><b>${esc(c.shop)}</b><span>${esc(shop.name)}</span></div>
    <div class="row"><b>${esc(c.customer)}</b><span>${esc(invoice.customer?.name ?? '')}</span></div>
    <div class="row"><b>${esc(c.invoice)}</b><span>${esc(invoice.id)}</span></div>
    <div class="row"><b>${esc(c.size)}</b><span>${esc(tire.size)}</span></div>
    <div class="row"><b>${esc(c.dot)}</b><span>${esc(tire.dotCode ?? '')}</span></div>
    <div class="row"><b>${esc(c.age)}</b><span>${tire.ageMonths ?? '—'} ${esc(c.months)}</span></div>
    <div class="row"><b>${esc(c.grade)}</b><span>${
      tire.grade ? `<span class="grade">${esc(tire.grade)}</span>` : '—'
    }</span></div>
  </section>

  <section>
    <h2>${esc(c.tread)} / ${esc(c.sidewall)}</h2>
    <div class="photos">
      ${photoCard(c.tread, doc.treadPhotoUrl)}
      ${photoCard(c.sidewall, doc.sidewallPhotoUrl)}
    </div>
  </section>

  ${
    doc.ageDisclosureRequired
      ? `<div class="disclosure"><b>${esc(c.disclosureTitle)}</b>${esc(c.disclosureBody)}</div>`
      : ''
  }

  <section class="signature">
    <b>${esc(c.signatureLabel)}</b>
    ${
      doc.customerSignatureUrl
        ? `<img src="${esc(doc.customerSignatureUrl)}" alt="${esc(c.signatureLabel)}" /><div>${esc(c.signedAt)}: ${esc(doc.signedAt?.toISOString() ?? '')}</div>`
        : `<div class="pending">${esc(c.notSigned)}</div>`
    }
  </section>

  <footer>${esc(c.footer)}</footer>
</div>
</body>
</html>`;

  return { html, language: lang, saleDocId: doc.id };
}
