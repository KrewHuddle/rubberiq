/**
 * Disposal queue (Module 12 — shop side).
 *
 * Scrap lifecycle: on_hand → awaiting_haul → in_transit → delivered.
 * Shop staff enqueue tires (manual or auto from FAIL grade), mark batches
 * ready for the hauler, attach a haul + facility, and receive a manifest.
 *
 * State-specific manifests:
 *   - NC Scrap Tire Certification (Parts I/II)  — buildNcCertification()
 *   - PA Act 90 manifest                          — buildPaManifest()
 *
 * Both are HTML stubs at this layer; PDF rendering ships in 12c.
 */
import { and, eq, inArray } from 'drizzle-orm';
import { getDb, schema } from '@rubberiq/db';

export type EnqueueInput = {
  shopId: string;
  tireId: string;
  reason: 'fail_grade' | 'aged_out' | 'damaged' | 'customer_swap';
};

export async function enqueueScrap(input: EnqueueInput): Promise<{ scrapId: string; created: boolean }> {
  const db = getDb();

  const tire = await db.query.tires.findFirst({ where: eq(schema.tires.id, input.tireId) });
  if (!tire) throw new Error(`tire_not_found:${input.tireId}`);
  if (tire.shopId !== input.shopId) throw new Error('cross_shop_forbidden');

  const existing = await db.query.scrapTires.findFirst({
    where: and(eq(schema.scrapTires.shopId, input.shopId), eq(schema.scrapTires.tireId, input.tireId)),
  });
  if (existing) return { scrapId: existing.id, created: false };

  const [row] = await db
    .insert(schema.scrapTires)
    .values({
      shopId: input.shopId,
      tireId: input.tireId,
      status: 'on_hand',
      reason: input.reason,
    })
    .returning({ id: schema.scrapTires.id });

  await db
    .update(schema.tires)
    .set({ status: 'scrapped', scrappedAt: new Date() })
    .where(eq(schema.tires.id, input.tireId));

  return { scrapId: row.id, created: true };
}

export type ScheduleHaulInput = {
  shopId: string;
  haulerId: string;
  destinationFacilityId: string;
  scrapIds: string[];
  scheduledFor?: Date;
};

export async function scheduleHaul(input: ScheduleHaulInput): Promise<{ haulId: string; tireCount: number }> {
  const db = getDb();

  if (input.scrapIds.length === 0) throw new Error('no_scrap_selected');

  const scraps = await db.query.scrapTires.findMany({
    where: and(
      eq(schema.scrapTires.shopId, input.shopId),
      inArray(schema.scrapTires.id, input.scrapIds),
    ),
  });
  if (scraps.length !== input.scrapIds.length) throw new Error('scrap_mismatch');
  if (scraps.some((s) => s.status !== 'on_hand')) throw new Error('scrap_not_on_hand');

  const hauler = await db.query.haulers.findFirst({ where: eq(schema.haulers.id, input.haulerId) });
  if (!hauler) throw new Error('hauler_not_found');
  const facility = await db.query.destinationFacilities.findFirst({
    where: eq(schema.destinationFacilities.id, input.destinationFacilityId),
  });
  if (!facility) throw new Error('facility_not_found');

  const [haul] = await db
    .insert(schema.hauls)
    .values({
      shopId: input.shopId,
      haulerId: input.haulerId,
      destinationFacilityId: input.destinationFacilityId,
      status: 'scheduled',
      scheduledFor: input.scheduledFor,
      tireCount: scraps.length,
    })
    .returning({ id: schema.hauls.id });

  await db
    .update(schema.scrapTires)
    .set({ status: 'awaiting_haul', haulId: haul.id })
    .where(inArray(schema.scrapTires.id, input.scrapIds));

  return { haulId: haul.id, tireCount: scraps.length };
}

export async function markHaulPickedUp(shopId: string, haulId: string): Promise<void> {
  const db = getDb();
  const haul = await db.query.hauls.findFirst({ where: eq(schema.hauls.id, haulId) });
  if (!haul || haul.shopId !== shopId) throw new Error('haul_not_found');
  const now = new Date();
  await db.update(schema.hauls).set({ status: 'in_transit', pickedUpAt: now }).where(eq(schema.hauls.id, haulId));
  await db
    .update(schema.scrapTires)
    .set({ status: 'in_transit' })
    .where(and(eq(schema.scrapTires.shopId, shopId), eq(schema.scrapTires.haulId, haulId)));
}

export async function markHaulDelivered(shopId: string, haulId: string): Promise<void> {
  const db = getDb();
  const haul = await db.query.hauls.findFirst({ where: eq(schema.hauls.id, haulId) });
  if (!haul || haul.shopId !== shopId) throw new Error('haul_not_found');
  const now = new Date();
  await db
    .update(schema.hauls)
    .set({ status: 'completed', deliveredAt: now })
    .where(eq(schema.hauls.id, haulId));
  await db
    .update(schema.scrapTires)
    .set({ status: 'delivered' })
    .where(and(eq(schema.scrapTires.shopId, shopId), eq(schema.scrapTires.haulId, haulId)));
}
