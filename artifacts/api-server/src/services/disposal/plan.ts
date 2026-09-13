/**
 * Route planning + fee reconciliation — Module 12b, pure layer.
 *
 * No DB, no I/O. Everything here is deterministic so the dispatch decisions
 * (who gets picked up, in what order, for how many tires) and the money math
 * (collected vs haul cost → margin) are unit-testable and reproducible.
 *
 * Planning policy — "tires until full":
 *   Longest-waiting shop first. Fill the truck. A shop that only partially
 *   fits still gets a stop for whatever fits (the rest stays queued for the
 *   next run) unless `allowPartial` is false, in which case it is skipped and
 *   a smaller shop behind it may take the remaining space.
 */

export type ShopDemand = {
  shopId: string;
  /** Scrap tires currently `on_hand` at this shop. */
  onHandCount: number;
  /** ISO timestamp of the oldest on-hand tire — the wait-time priority key. */
  oldestOnHandSince: string;
};

export type RouteStop = {
  shopId: string;
  tireCount: number;
  /** True when the truck could not take this shop's whole on-hand pile. */
  partial: boolean;
};

export type RoutePlan = {
  stops: RouteStop[];
  plannedTireCount: number;
  remainingCapacity: number;
  /** Shops that were considered but got no space on this run. */
  skipped: string[];
};

export type PlanOptions = {
  /** Cap on stops per run (driver hours), not on tires. */
  maxStops?: number;
  /** Default true. False = all-or-nothing per shop. */
  allowPartial?: boolean;
};

/**
 * Order demand by wait time (oldest first), then by pile size (biggest first),
 * then by shopId so the plan is stable for identical inputs.
 */
export function prioritizeDemand(demand: ShopDemand[]): ShopDemand[] {
  return [...demand].sort((a, b) => {
    const at = Date.parse(a.oldestOnHandSince);
    const bt = Date.parse(b.oldestOnHandSince);
    if (at !== bt) return at - bt;
    if (a.onHandCount !== b.onHandCount) return b.onHandCount - a.onHandCount;
    return a.shopId < b.shopId ? -1 : a.shopId > b.shopId ? 1 : 0;
  });
}

export function planRoute(
  demand: ShopDemand[],
  capacity: number,
  opts: PlanOptions = {},
): RoutePlan {
  if (!Number.isInteger(capacity) || capacity <= 0) throw new Error('invalid_capacity');
  const maxStops = opts.maxStops ?? Number.POSITIVE_INFINITY;
  if (maxStops <= 0) throw new Error('invalid_max_stops');
  const allowPartial = opts.allowPartial ?? true;

  const stops: RouteStop[] = [];
  const skipped: string[] = [];
  let remaining = capacity;

  for (const d of prioritizeDemand(demand)) {
    if (d.onHandCount <= 0) continue; // nothing to collect — not a skip

    if (remaining <= 0 || stops.length >= maxStops) {
      skipped.push(d.shopId);
      continue;
    }

    const take = Math.min(d.onHandCount, remaining);
    if (take < d.onHandCount && !allowPartial) {
      skipped.push(d.shopId);
      continue;
    }

    stops.push({ shopId: d.shopId, tireCount: take, partial: take < d.onHandCount });
    remaining -= take;
  }

  return {
    stops,
    plannedTireCount: capacity - remaining,
    remainingCapacity: remaining,
    skipped,
  };
}

export type StopRevenue = {
  shopId: string;
  tireCount: number;
  /** Per-tire disposal fee the shop charges its customers. */
  disposalFeeCents: number;
};

export type StopReconciliation = {
  shopId: string;
  tireCount: number;
  collectedCents: number;
  /** This stop's share of the run's haul cost. */
  feeCents: number;
  marginCents: number;
};

export type RouteReconciliation = {
  stops: StopReconciliation[];
  collectedCents: number;
  haulCostCents: number;
  marginCents: number;
  /** Margin as basis points of collected revenue; 0 when nothing was collected. */
  marginBps: number;
};

/**
 * Split one run's haul cost across its stops in proportion to tires carried,
 * then compute margin. Integer cents throughout: each stop is floored and the
 * last stop absorbs the rounding remainder, so stop costs always re-sum to
 * exactly `haulCostCents`.
 */
export function reconcileRouteFees(
  stops: StopRevenue[],
  haulCostCents: number,
): RouteReconciliation {
  if (!Number.isInteger(haulCostCents) || haulCostCents < 0) throw new Error('invalid_haul_cost');

  const totalTires = stops.reduce((n, s) => n + s.tireCount, 0);

  let allocated = 0;
  const out: StopReconciliation[] = stops.map((s, i) => {
    const isLast = i === stops.length - 1;
    const feeCents = isLast
      ? haulCostCents - allocated
      : totalTires > 0
        ? Math.floor((haulCostCents * s.tireCount) / totalTires)
        : 0;
    allocated += feeCents;
    const collectedCents = s.tireCount * s.disposalFeeCents;
    return {
      shopId: s.shopId,
      tireCount: s.tireCount,
      collectedCents,
      feeCents,
      marginCents: collectedCents - feeCents,
    };
  });

  const collectedCents = out.reduce((n, s) => n + s.collectedCents, 0);
  const marginCents = collectedCents - haulCostCents;

  return {
    stops: out,
    collectedCents,
    haulCostCents,
    marginCents,
    marginBps: collectedCents > 0 ? Math.round((marginCents / collectedCents) * 10_000) : 0,
  };
}
