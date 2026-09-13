import { describe, it, expect } from 'vitest';
import {
  planRoute,
  prioritizeDemand,
  reconcileRouteFees,
  type ShopDemand,
} from './plan.js';

const demand = (shopId: string, onHandCount: number, oldestOnHandSince: string): ShopDemand => ({
  shopId,
  onHandCount,
  oldestOnHandSince,
});

describe('prioritizeDemand', () => {
  it('orders longest-waiting first', () => {
    const out = prioritizeDemand([
      demand('b', 10, '2026-09-10T00:00:00Z'),
      demand('a', 10, '2026-09-01T00:00:00Z'),
      demand('c', 10, '2026-09-05T00:00:00Z'),
    ]);
    expect(out.map((d) => d.shopId)).toEqual(['a', 'c', 'b']);
  });

  it('breaks wait-time ties by bigger pile, then shopId', () => {
    const t = '2026-09-01T00:00:00Z';
    const out = prioritizeDemand([demand('z', 5, t), demand('a', 5, t), demand('m', 40, t)]);
    expect(out.map((d) => d.shopId)).toEqual(['m', 'a', 'z']);
  });
});

describe('planRoute', () => {
  it('fills the truck oldest-first and leaves the overflow queued', () => {
    const plan = planRoute(
      [
        demand('old', 60, '2026-09-01T00:00:00Z'),
        demand('mid', 50, '2026-09-05T00:00:00Z'),
        demand('new', 30, '2026-09-09T00:00:00Z'),
      ],
      100,
    );

    expect(plan.stops).toEqual([
      { shopId: 'old', tireCount: 60, partial: false },
      { shopId: 'mid', tireCount: 40, partial: true },
    ]);
    expect(plan.plannedTireCount).toBe(100);
    expect(plan.remainingCapacity).toBe(0);
    expect(plan.skipped).toEqual(['new']);
  });

  it('stops exactly at capacity when demand lines up', () => {
    const plan = planRoute(
      [demand('a', 40, '2026-09-01T00:00:00Z'), demand('b', 60, '2026-09-02T00:00:00Z')],
      100,
    );
    expect(plan.plannedTireCount).toBe(100);
    expect(plan.remainingCapacity).toBe(0);
    expect(plan.stops.every((s) => !s.partial)).toBe(true);
    expect(plan.skipped).toEqual([]);
  });

  it('under-fills rather than inventing tires', () => {
    const plan = planRoute([demand('a', 12, '2026-09-01T00:00:00Z')], 100);
    expect(plan.plannedTireCount).toBe(12);
    expect(plan.remainingCapacity).toBe(88);
  });

  it('allowPartial=false skips a shop that does not fit and takes a smaller one behind it', () => {
    const plan = planRoute(
      [
        demand('big', 80, '2026-09-01T00:00:00Z'),
        demand('huge', 90, '2026-09-02T00:00:00Z'),
        demand('small', 15, '2026-09-03T00:00:00Z'),
      ],
      100,
      { allowPartial: false },
    );
    expect(plan.stops).toEqual([
      { shopId: 'big', tireCount: 80, partial: false },
      { shopId: 'small', tireCount: 15, partial: false },
    ]);
    expect(plan.skipped).toEqual(['huge']);
  });

  it('honours maxStops even with capacity to spare', () => {
    const plan = planRoute(
      [
        demand('a', 10, '2026-09-01T00:00:00Z'),
        demand('b', 10, '2026-09-02T00:00:00Z'),
        demand('c', 10, '2026-09-03T00:00:00Z'),
      ],
      100,
      { maxStops: 2 },
    );
    expect(plan.stops.map((s) => s.shopId)).toEqual(['a', 'b']);
    expect(plan.skipped).toEqual(['c']);
    expect(plan.remainingCapacity).toBe(80);
  });

  it('ignores shops with nothing on hand without marking them skipped', () => {
    const plan = planRoute(
      [demand('empty', 0, '2026-09-01T00:00:00Z'), demand('a', 5, '2026-09-02T00:00:00Z')],
      100,
    );
    expect(plan.stops).toEqual([{ shopId: 'a', tireCount: 5, partial: false }]);
    expect(plan.skipped).toEqual([]);
  });

  it('rejects a non-positive capacity', () => {
    expect(() => planRoute([], 0)).toThrow('invalid_capacity');
    expect(() => planRoute([], -5)).toThrow('invalid_capacity');
  });

  it('is deterministic for identical input', () => {
    const input = [
      demand('a', 30, '2026-09-01T00:00:00Z'),
      demand('b', 30, '2026-09-01T00:00:00Z'),
      demand('c', 30, '2026-09-01T00:00:00Z'),
    ];
    expect(planRoute(input, 70)).toEqual(planRoute([...input].reverse(), 70));
  });
});

describe('reconcileRouteFees', () => {
  it('splits haul cost by tire share and computes margin', () => {
    const r = reconcileRouteFees(
      [
        { shopId: 'a', tireCount: 60, disposalFeeCents: 300 },
        { shopId: 'b', tireCount: 40, disposalFeeCents: 300 },
      ],
      10_000,
    );

    expect(r.stops[0]).toEqual({
      shopId: 'a',
      tireCount: 60,
      collectedCents: 18_000,
      feeCents: 6_000,
      marginCents: 12_000,
    });
    expect(r.collectedCents).toBe(30_000);
    expect(r.marginCents).toBe(20_000);
    expect(r.marginBps).toBe(6_667);
  });

  it('allocates every cent — the last stop absorbs the rounding remainder', () => {
    const r = reconcileRouteFees(
      [
        { shopId: 'a', tireCount: 1, disposalFeeCents: 300 },
        { shopId: 'b', tireCount: 1, disposalFeeCents: 300 },
        { shopId: 'c', tireCount: 1, disposalFeeCents: 300 },
      ],
      100,
    );
    expect(r.stops.map((s) => s.feeCents)).toEqual([33, 33, 34]);
    expect(r.stops.reduce((n, s) => n + s.feeCents, 0)).toBe(100);
  });

  it('reports a negative margin when the run loses money', () => {
    const r = reconcileRouteFees([{ shopId: 'a', tireCount: 10, disposalFeeCents: 100 }], 5_000);
    expect(r.collectedCents).toBe(1_000);
    expect(r.marginCents).toBe(-4_000);
    expect(r.marginBps).toBe(-40_000);
  });

  it('handles differing per-shop disposal fees', () => {
    const r = reconcileRouteFees(
      [
        { shopId: 'nc', tireCount: 50, disposalFeeCents: 300 },
        { shopId: 'pa', tireCount: 50, disposalFeeCents: 500 },
      ],
      0,
    );
    expect(r.collectedCents).toBe(40_000);
    expect(r.marginCents).toBe(40_000);
    expect(r.marginBps).toBe(10_000);
  });

  it('returns zeroed totals with no stops', () => {
    const r = reconcileRouteFees([], 0);
    expect(r).toEqual({
      stops: [],
      collectedCents: 0,
      haulCostCents: 0,
      marginCents: 0,
      marginBps: 0,
    });
  });

  it('rejects a negative haul cost', () => {
    expect(() => reconcileRouteFees([], -1)).toThrow('invalid_haul_cost');
  });
});
