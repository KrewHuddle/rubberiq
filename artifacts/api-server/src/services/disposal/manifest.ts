/**
 * Manifest renderer — state-specific HTML for the hauler + state inspector.
 *
 * NC Scrap-Tire Certification (Parts I/II): generator-attested chain-of-custody.
 * PA Act 90 manifest: waste-tire transporter manifest, Act 90 + DEP reqs.
 *
 * Selects template by hauler state. Renders a single page of HTML; PDF
 * conversion in 12c via headless Chromium (deferred).
 */
import { eq, and, inArray } from 'drizzle-orm';
import { getDb, schema } from '@rubberiq/db';

type RenderInput = {
  shopId: string;
  haulId: string;
};

export function esc(s: string | null | undefined): string {
  if (s == null) return '';
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fmt(d: Date | null | undefined): string {
  if (!d) return '—';
  return d.toISOString().slice(0, 19).replace('T', ' ') + ' UTC';
}

/** Pure: hauler.state → manifest template code. PA gets Act 90; else NC Scrap-Tire Cert. */
export function selectManifestTemplate(haulerState: string | null | undefined): 'NC' | 'PA' {
  return haulerState === 'PA' ? 'PA' : 'NC';
}

export async function renderManifest(input: RenderInput): Promise<{ html: string; template: 'NC' | 'PA' }> {
  const db = getDb();

  const haul = await db.query.hauls.findFirst({ where: eq(schema.hauls.id, input.haulId) });
  if (!haul || haul.shopId !== input.shopId) throw new Error('haul_not_found');

  const [shop, hauler, facility] = await Promise.all([
    db.query.shops.findFirst({ where: eq(schema.shops.id, haul.shopId) }),
    db.query.haulers.findFirst({ where: eq(schema.haulers.id, haul.haulerId) }),
    db.query.destinationFacilities.findFirst({
      where: eq(schema.destinationFacilities.id, haul.destinationFacilityId),
    }),
  ]);
  if (!shop || !hauler || !facility) throw new Error('haul_orphaned');

  const scrapRows = await db.query.scrapTires.findMany({
    where: and(eq(schema.scrapTires.shopId, haul.shopId), eq(schema.scrapTires.haulId, haul.id)),
  });

  const tireIds = scrapRows.map((s) => s.tireId).filter((id): id is string => !!id);
  const tires = tireIds.length
    ? await db.query.tires.findMany({ where: inArray(schema.tires.id, tireIds) })
    : [];
  const tireById = new Map(tires.map((t) => [t.id, t]));
  if (tires.length !== tireIds.length) {
    console.warn(
      `manifest haul=${haul.id} scrapRows=${scrapRows.length} expected_tires=${tireIds.length} found_tires=${tires.length}`,
    );
  }

  const template: 'NC' | 'PA' = hauler.state === 'PA' ? 'PA' : 'NC';

  const tireRows = scrapRows
    .map((s, idx) => {
      const t = s.tireId ? tireById.get(s.tireId) : undefined;
      return `<tr>
        <td>${idx + 1}</td>
        <td>${esc(s.tireId ?? '—')}</td>
        <td>${esc(t?.size ?? '—')}</td>
        <td>${esc(t?.dotCode ?? '—')}</td>
        <td>${esc(s.reason ?? '—')}</td>
        <td>${esc(s.status)}</td>
      </tr>`;
    })
    .join('');

  const titleByTemplate = {
    NC: 'NC Scrap-Tire Certification (Parts I &amp; II)',
    PA: 'PA Act 90 — Waste Tire Transporter Manifest',
  } as const;

  const stateBlurb =
    template === 'NC'
      ? 'Generator (selling shop) certifies these scrap tires are delivered to a permitted hauler for transport to a permitted disposal facility, per 15A NCAC 13B .1100. Retain 3 years.'
      : 'Generator certifies waste-tire delivery to a PA DEP-authorized transporter; transporter Act 90 number and destination DEP permit recorded. Retain 3 years.';

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${titleByTemplate[template]} — ${esc(shop.name)}</title>
<style>
  :root { color-scheme: light; }
  body { margin: 0; font-family: "IBM Plex Sans", system-ui, sans-serif; color: oklch(20% 0.015 60); background: white; }
  .doc { max-width: 820px; margin: 0 auto; padding: 28px 24px; }
  h1 { font-family: "Space Grotesk", sans-serif; letter-spacing: -0.02em; font-size: 24px; margin: 0 0 6px; }
  h2 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.16em; color: oklch(45% 0.012 60); margin: 24px 0 10px; }
  .sub { color: oklch(45% 0.012 60); font-size: 12px; margin: 0 0 16px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 24px; padding: 12px 0; border-top: 1px solid oklch(80% 0.005 60); border-bottom: 1px solid oklch(80% 0.005 60); }
  .field { font-size: 12px; }
  .field b { display: block; font-size: 10px; text-transform: uppercase; letter-spacing: 0.12em; color: oklch(45% 0.012 60); margin-bottom: 2px; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0 24px; font-size: 11px; font-variant-numeric: tabular-nums; }
  th, td { padding: 6px 8px; text-align: left; border-bottom: 1px solid oklch(88% 0.005 95); }
  th { font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: oklch(45% 0.012 60); }
  .blurb { background: oklch(95% 0.005 95); border: 1px solid oklch(80% 0.005 60); padding: 12px 14px; font-size: 12px; line-height: 1.5; }
  .sig { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 32px; }
  .sig div { border-top: 1px solid oklch(20% 0.015 60); padding-top: 8px; }
  .sig b { display: block; font-size: 11px; text-transform: uppercase; letter-spacing: 0.12em; color: oklch(45% 0.012 60); }
  footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid oklch(88% 0.005 95); font-size: 10px; color: oklch(58% 0.008 60); }
  @media print { .doc { padding: 0; max-width: none; } }
</style>
</head>
<body>
<div class="doc">
  <header>
    <h1>${titleByTemplate[template]}</h1>
    <p class="sub">Haul ${esc(haul.id)} · ${fmt(haul.scheduledFor ?? haul.createdAt)}</p>
  </header>

  <div class="grid">
    <div class="field"><b>Generator (shop)</b>${esc(shop.name)} · ${esc(shop.city ?? '')} ${esc(shop.state)}</div>
    <div class="field"><b>Hauler</b>${esc(hauler.name)} · permit ${esc(hauler.permitNumber ?? '—')}</div>
    <div class="field"><b>Hauler contact</b>${esc(hauler.contactName ?? '')} · ${esc(hauler.contactPhone ?? '')}</div>
    <div class="field"><b>Destination facility</b>${esc(facility.name)} · ${esc(facility.city ?? '')} ${esc(facility.state)} · permit ${esc(facility.permitNumber ?? '—')}</div>
    <div class="field"><b>Scheduled pickup</b>${fmt(haul.scheduledFor)}</div>
    <div class="field"><b>Tire count</b>${haul.tireCount}</div>
  </div>

  <h2>Tires on this haul</h2>
  <table>
    <thead><tr><th>#</th><th>Tire ID</th><th>Size</th><th>DOT</th><th>Reason</th><th>Status</th></tr></thead>
    <tbody>${tireRows || '<tr><td colspan="6">No tires recorded.</td></tr>'}</tbody>
  </table>

  <div class="blurb">${stateBlurb}</div>

  <div class="sig">
    <div><b>Generator signature</b>&nbsp;</div>
    <div><b>Hauler signature</b>&nbsp;</div>
  </div>

  <footer>
    Generated by RubberIQ · ${fmt(new Date())} · template: ${template}
  </footer>
</div>
</body>
</html>`;

  return { html, template };
}
