/**
 * Sale-doc generator (Module 11).
 *
 * On a used-tire sale, build a liability/disclosure record capturing:
 *   - Tire identity (size, DOT, brand/model)
 *   - Condition snapshot at sale (treadDepth32nds, ageMonths, grade)
 *   - Tread + sidewall photos
 *   - Age-disclosure flag (true when ageMonths > AGE_DISCLOSURE_MONTHS)
 *
 * The doc is the customer's paper trail and the shop's liability shield.
 * One row per (invoice, tire) — idempotent on that pair.
 */
import { and, eq } from 'drizzle-orm';
import { getDb, schema } from '@rubberiq/db';

/** Threshold above which the customer must explicitly acknowledge tire age. */
export const AGE_DISCLOSURE_MONTHS = 60;

export type GenerateSaleDocInput = {
  shopId: string;
  invoiceId: string;
  tireId: string;
  language?: string; // defaults to invoice customer's language, then 'en'
};

export type GenerateSaleDocResult = {
  saleDocId: string;
  created: boolean; // false if already existed
  ageDisclosureRequired: boolean;
};

export async function generateSaleDoc(input: GenerateSaleDocInput): Promise<GenerateSaleDocResult> {
  const db = getDb();

  const [tire, invoice] = await Promise.all([
    db.query.tires.findFirst({ where: eq(schema.tires.id, input.tireId) }),
    db.query.invoices.findFirst({
      where: eq(schema.invoices.id, input.invoiceId),
      with: { customer: true },
    }),
  ]);

  if (!tire) throw new Error(`tire_not_found:${input.tireId}`);
  if (invoice == null) throw new Error(`invoice_not_found:${input.invoiceId}`);
  if (tire.shopId !== input.shopId || invoice.shopId !== input.shopId) {
    throw new Error('cross_shop_forbidden');
  }

  const existing = await db.query.saleDocs.findFirst({
    where: and(
      eq(schema.saleDocs.invoiceId, input.invoiceId),
      eq(schema.saleDocs.tireId, input.tireId),
    ),
  });

  const ageDisclosureRequired = (tire.ageMonths ?? 0) > AGE_DISCLOSURE_MONTHS;

  if (existing) {
    // ageDisclosureRequired is LOCKED at creation — it records the disclosure
    // state at the moment of sale. Even if tire.ageMonths is later updated,
    // the doc's flag stays true to the original disclosure decision (this is
    // the liability record's whole purpose). Do NOT recompute on reuse.
    return {
      saleDocId: existing.id,
      created: false,
      ageDisclosureRequired: existing.ageDisclosureRequired,
    };
  }

  const language =
    input.language ?? invoice.customer?.language ?? 'en';

  const [row] = await db
    .insert(schema.saleDocs)
    .values({
      invoiceId: input.invoiceId,
      tireId: input.tireId,
      language,
      treadPhotoUrl: tire.treadPhotoUrl,
      sidewallPhotoUrl: tire.sidewallPhotoUrl,
      dotCode: tire.dotCode,
      ageMonths: tire.ageMonths,
      grade: tire.grade,
      ageDisclosureRequired,
    })
    .returning({ id: schema.saleDocs.id });

  return { saleDocId: row.id, created: true, ageDisclosureRequired };
}

export async function markSaleDocSigned(
  saleDocId: string,
  signatureUrl: string,
): Promise<void> {
  const db = getDb();
  await db
    .update(schema.saleDocs)
    .set({
      customerSignatureUrl: signatureUrl,
      signedAt: new Date(),
    })
    .where(eq(schema.saleDocs.id, saleDocId));
}
