/**
 * Disposal service dispatch — Module 12b/12c, DB layer.
 *
 * This is the platform side of disposal (the second revenue stream), distinct
 * from the shop-side queue in `queue.ts`:
 *
 *   queue.ts     a shop schedules its own haul with its own hauler
 *   dispatch.ts  the platform sees scrap-on-hand across every shop, batches it
 *                into truck runs, and reconciles fees collected vs haul cost
 *
 * A route stop materializes as a normal `hauls` row tagged with the route id,
 * so shop-side compliance (NC certification, PA Act 90 manifest) is unchanged.
 *
 * Operational note: the code ships regardless, but switching dispatch ON needs
 * the NC hauler registration + a permitted destination facility.
 */
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { getDb, schema } from '@rubberiq/db';
import { planRoute, reconcileRouteFees, type ShopDemand } from './plan.js';

/* ============================================================
 * Pickup queue — the demand signal
 * ========================================================== */

export type PickupQueueRow = {
  shopId: string;
  shopName: string;
  state: string;
  city: string | null;
  onHandCount: number;
  oldestOnHandSince: string;
  daysWaiting: number;
  disposalFeeCents: number;
};

function daysBetween(from: Date, to: Date): number {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / 86_400_000));
}

/** Every shop with scrap `on_hand`, longest-waiting first. */
export async function getPickupQueue(opts: { state?: string } = {}): Promise<PickupQueueRow[]> {
  const db = getDb();

  const rows = await db
    .select({
      shopId: schema.shops.id,
      shopName: schema.shops.name,
      state: schema.shops.state,
      city: schema.shops.city,
      disposalFeeCents: schema.shops.disposalFeeCents,
      onHandCount: sql<number>`count(${schema.scrapTires.id})::int`,
      oldestOnHandSince: sql<Date>`min(${schema.scrapTires.onHandSince})`,
    })
    .from(schema.shops)
    .innerJoin(
      schema.scrapTires,
      and(
        eq(schema.scrapTires.shopId, schema.shops.id),
        eq(schema.scrapTires.status, 'on_hand'),
      ),
    )
    .where(opts.state ? eq(schema.shops.state, opts.state) : undefined)
    .groupBy(schema.shops.id)
    .orderBy(asc(sql`min(${schema.scrapTires.onHandSince})`));

  const now = new Date();
  return rows.map((r) => {
    const oldest = new Date(r.oldestOnHandSince);
    return {
      shopId: r.shopId,
      shopName: r.shopName,
      state: r.state,
      city: r.city,
      disposalFeeCents: r.disposalFeeCents,
      onHandCount: r.onHandCount,
      oldestOnHandSince: oldest.toISOString(),
      daysWaiting: daysBetween(oldest, now),
    };
  });
}

/** Cross-shop scrap volume, grouped for the platform map. */
export async function getScrapVolumeMap(): Promise<
  Array<{
    state: string;
    city: string | null;
    shopCount: number;
    onHandCount: number;
    oldestOnHandSince: string | null;
  }>
> {
  const db = getDb();

  const rows = await db
    .select({
      state: schema.shops.state,
      city: schema.shops.city,
      shopCount: sql<number>`count(distinct ${schema.shops.id})::int`,
      onHandCount: sql<number>`count(${schema.scrapTires.id})::int`,
      oldestOnHandSince: sql<Date | null>`min(${schema.scrapTires.onHandSince})`,
    })
    .from(schema.shops)
    .innerJoin(
      schema.scrapTires,
      and(
        eq(schema.scrapTires.shopId, schema.shops.id),
        eq(schema.scrapTires.status, 'on_hand'),
      ),
    )
    .groupBy(schema.shops.state, schema.shops.city)
    .orderBy(desc(sql`count(${schema.scrapTires.id})`));

  return rows.map((r) => ({
    state: r.state,
    city: r.city,
    shopCount: r.shopCount,
    onHandCount: r.onHandCount,
    oldestOnHandSince: r.oldestOnHandSince ? new Date(r.oldestOnHandSince).toISOString() : null,
  }));
}

/* ============================================================
 * Route creation — "tires until full"
 * ========================================================== */

export type CreateRouteInput = {
  haulerId: string;
  destinationFacilityId: string;
  /** Overrides the hauler's registered truckCapacity for this run. */
  capacity?: number;
  state?: string;
  maxStops?: number;
  allowPartial?: boolean;
  scheduledFor?: Date;
  createdByPlatformUserId?: string;
};

export type CreateRouteResult = {
  routeId: string;
  capacity: number;
  plannedTireCount: number;
  stopCount: number;
  remainingCapacity: number;
  skippedShopIds: string[];
  stops: Array<{ shopId: string; haulId: string; tireCount: number; partial: boolean }>;
};

export async function createRoute(input: CreateRouteInput): Promise<CreateRouteResult> {
  const db = getDb();

  const hauler = await db.query.haulers.findFirst({
    where: eq(schema.haulers.id, input.haulerId),
  });
  if (!hauler) throw new Error('hauler_not_found');
  if (!hauler.verified) throw new Error('hauler_not_verified');

  const facility = await db.query.destinationFacilities.findFirst({
    where: eq(schema.destinationFacilities.id, input.destinationFacilityId),
  });
  if (!facility) throw new Error('facility_not_found');
  if (!facility.verified) throw new Error('facility_not_verified');

  const capacity = input.capacity ?? hauler.truckCapacity ?? 0;
  if (!Number.isInteger(capacity) || capacity <= 0) throw new Error('invalid_capacity');

  const queue = await getPickupQueue({ state: input.state });
  const demand: ShopDemand[] = queue.map((q) => ({
    shopId: q.shopId,
    onHandCount: q.onHandCount,
    oldestOnHandSince: q.oldestOnHandSince,
  }));

  const plan = planRoute(demand, capacity, {
    maxStops: input.maxStops,
    allowPartial: input.allowPartial,
  });
  if (plan.stops.length === 0) throw new Error('no_scrap_available');

  return db.transaction(async (tx) => {
    const [route] = await tx
      .insert(schema.dispatchRoutes)
      .values({
        haulerId: input.haulerId,
        destinationFacilityId: input.destinationFacilityId,
        status: 'scheduled',
        capacity,
        plannedTireCount: plan.plannedTireCount,
        stopCount: plan.stops.length,
        state: input.state,
        scheduledFor: input.scheduledFor,
        createdByPlatformUserId: input.createdByPlatformUserId,
      })
      .returning({ id: schema.dispatchRoutes.id });

    const stops: CreateRouteResult['stops'] = [];

    for (const stop of plan.stops) {
      // Re-read inside the transaction and take the oldest N still on hand, so
      // a concurrent shop-side haul cannot double-claim the same scrap rows.
      const scraps = await tx.query.scrapTires.findMany({
        where: and(
          eq(schema.scrapTires.shopId, stop.shopId),
          eq(schema.scrapTires.status, 'on_hand'),
        ),
        orderBy: (s) => [asc(s.onHandSince)],
        limit: stop.tireCount,
      });
      if (scraps.length === 0) continue;

      const [haul] = await tx
        .insert(schema.hauls)
        .values({
          shopId: stop.shopId,
          haulerId: input.haulerId,
          destinationFacilityId: input.destinationFacilityId,
          routeId: route.id,
          status: 'scheduled',
          scheduledFor: input.scheduledFor,
          tireCount: scraps.length,
        })
        .returning({ id: schema.hauls.id });

      await tx
        .update(schema.scrapTires)
        .set({ status: 'awaiting_haul', haulId: haul.id })
        .where(
          inArray(
            schema.scrapTires.id,
            scraps.map((s) => s.id),
          ),
        );

      stops.push({
        shopId: stop.shopId,
        haulId: haul.id,
        tireCount: scraps.length,
        partial: stop.partial || scraps.length < stop.tireCount,
      });
    }

    if (stops.length === 0) throw new Error('no_scrap_available');

    // The claimed count can come in under plan if scrap moved between planning
    // and commit — persist what was actually claimed, not what was projected.
    const claimed = stops.reduce((n, s) => n + s.tireCount, 0);
    if (claimed !== plan.plannedTireCount || stops.length !== plan.stops.length) {
      await tx
        .update(schema.dispatchRoutes)
        .set({ plannedTireCount: claimed, stopCount: stops.length })
        .where(eq(schema.dispatchRoutes.id, route.id));
    }

    return {
      routeId: route.id,
      capacity,
      plannedTireCount: claimed,
      stopCount: stops.length,
      remainingCapacity: capacity - claimed,
      skippedShopIds: plan.skipped,
      stops,
    };
  });
}

/* ============================================================
 * Route lifecycle
 * ========================================================== */

export async function listRoutes(limit = 100) {
  const db = getDb();
  return db.query.dispatchRoutes.findMany({
    orderBy: (r) => [desc(r.createdAt)],
    limit,
  });
}

export async function getRoute(routeId: string) {
  const db = getDb();
  const route = await db.query.dispatchRoutes.findFirst({
    where: eq(schema.dispatchRoutes.id, routeId),
  });
  if (!route) throw new Error('route_not_found');
  const hauls = await db.query.hauls.findMany({
    where: eq(schema.hauls.routeId, routeId),
    orderBy: (h) => [asc(h.createdAt)],
  });
  return { route, hauls };
}

/** Advance every stop on a route at once (the truck moves as one unit). */
export async function advanceRoute(
  routeId: string,
  to: 'in_transit' | 'completed' | 'cancelled',
): Promise<{ haulCount: number }> {
  const db = getDb();

  const route = await db.query.dispatchRoutes.findFirst({
    where: eq(schema.dispatchRoutes.id, routeId),
  });
  if (!route) throw new Error('route_not_found');
  if (route.status === 'completed' || route.status === 'cancelled')
    throw new Error('route_already_closed');

  const now = new Date();
  const scrapStatus =
    to === 'in_transit' ? 'in_transit' : to === 'completed' ? 'delivered' : 'on_hand';

  return db.transaction(async (tx) => {
    const hauls = await tx.query.hauls.findMany({ where: eq(schema.hauls.routeId, routeId) });
    const haulIds = hauls.map((h) => h.id);

    await tx
      .update(schema.dispatchRoutes)
      .set({ status: to })
      .where(eq(schema.dispatchRoutes.id, routeId));

    if (haulIds.length > 0) {
      await tx
        .update(schema.hauls)
        .set({
          status: to,
          pickedUpAt: to === 'in_transit' ? now : undefined,
          deliveredAt: to === 'completed' ? now : undefined,
        })
        .where(inArray(schema.hauls.id, haulIds));

      await tx
        .update(schema.scrapTires)
        .set({
          status: scrapStatus,
          // A cancelled run releases the scrap back to the queue.
          haulId: to === 'cancelled' ? null : undefined,
        })
        .where(inArray(schema.scrapTires.haulId, haulIds));
    }

    return { haulCount: haulIds.length };
  });
}

/* ============================================================
 * Fee reconciliation — collected vs haul cost → margin
 * ========================================================== */

export type ReconcileResult = {
  routeId: string;
  collectedCents: number;
  haulCostCents: number;
  marginCents: number;
  marginBps: number;
  stops: Array<{
    haulId: string;
    shopId: string;
    tireCount: number;
    collectedCents: number;
    feeCents: number;
    marginCents: number;
  }>;
};

/**
 * Close out a run's money: the shops collected a per-tire disposal fee from
 * customers; the hauler charged us `haulCostCents` for the run. Cost is split
 * across stops by tire share (see reconcileRouteFees).
 */
export async function reconcileRoute(
  routeId: string,
  haulCostCents: number,
): Promise<ReconcileResult> {
  const db = getDb();

  const route = await db.query.dispatchRoutes.findFirst({
    where: eq(schema.dispatchRoutes.id, routeId),
  });
  if (!route) throw new Error('route_not_found');

  const hauls = await db.query.hauls.findMany({
    where: eq(schema.hauls.routeId, routeId),
    orderBy: (h) => [asc(h.createdAt)],
  });
  if (hauls.length === 0) throw new Error('route_has_no_stops');

  const shopIds = [...new Set(hauls.map((h) => h.shopId))];
  const shops = await db.query.shops.findMany({ where: inArray(schema.shops.id, shopIds) });
  const feeByShop = new Map(shops.map((s) => [s.id, s.disposalFeeCents]));

  const reconciliation = reconcileRouteFees(
    hauls.map((h) => ({
      shopId: h.shopId,
      tireCount: h.tireCount,
      disposalFeeCents: feeByShop.get(h.shopId) ?? 0,
    })),
    haulCostCents,
  );

  const now = new Date();

  await db.transaction(async (tx) => {
    for (const [i, haul] of hauls.entries()) {
      const s = reconciliation.stops[i];
      await tx
        .update(schema.hauls)
        .set({
          collectedCents: s.collectedCents,
          feeCents: s.feeCents,
          marginCents: s.marginCents,
          reconciledAt: now,
        })
        .where(eq(schema.hauls.id, haul.id));
    }

    await tx
      .update(schema.dispatchRoutes)
      .set({
        collectedCents: reconciliation.collectedCents,
        haulCostCents: reconciliation.haulCostCents,
        marginCents: reconciliation.marginCents,
        reconciledAt: now,
      })
      .where(eq(schema.dispatchRoutes.id, routeId));
  });

  return {
    routeId,
    collectedCents: reconciliation.collectedCents,
    haulCostCents: reconciliation.haulCostCents,
    marginCents: reconciliation.marginCents,
    marginBps: reconciliation.marginBps,
    stops: hauls.map((h, i) => ({
      haulId: h.id,
      shopId: h.shopId,
      tireCount: h.tireCount,
      collectedCents: reconciliation.stops[i].collectedCents,
      feeCents: reconciliation.stops[i].feeCents,
      marginCents: reconciliation.stops[i].marginCents,
    })),
  };
}
