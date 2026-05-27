/**
 * Module 16 — health aggregator (per shop, weekly snapshot).
 *
 * Reads the 28-day windowed signals out of the live DB, runs them through the
 * pure scoring fn in ./score.ts, upserts a row into health_signals keyed by
 * (shopId, period=YYYY-MM-DD), and mirrors the latest result onto
 * shops.healthScore / healthBand / healthUpdatedAt so the shop dashboard can
 * show it without a join.
 *
 * Side-effect: Module 17 alert emission — when a shop's band degrades vs the
 * previous snapshot (green→yellow, yellow→red, green→red), an account_alerts
 * row is inserted with type='churn_risk' (or 'dormant' if score=0).
 */
import { and, desc, eq, gte, sql } from 'drizzle-orm';
import { getDb, schema } from '@rubberiq/db';
import { computeHealth, type HealthBand } from './score.js';

export type AggregateOneResult = {
  shopId: string;
  period: string;
  score: number;
  band: HealthBand;
  alertEmitted: boolean;
};

const MS_PER_DAY = 86_400_000;
const WINDOW_DAYS = 28;

function todayPeriod(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function daysBetween(from: Date | null, to: Date): number | null {
  if (!from) return null;
  return Math.floor((to.getTime() - from.getTime()) / MS_PER_DAY);
}

const BAND_RANK: Record<HealthBand, number> = { green: 2, yellow: 1, red: 0 };

export async function aggregateHealthForShop(
  shopId: string,
  now: Date = new Date(),
): Promise<AggregateOneResult> {
  const db = getDb();
  const period = todayPeriod(now);
  const windowStart = new Date(now.getTime() - WINDOW_DAYS * MS_PER_DAY);

  /* ---------- pull inputs ---------- */
  const [{ lastLogin }] = await db
    .select({ lastLogin: sql<Date | null>`max(${schema.users.lastLoginAt})` })
    .from(schema.users)
    .where(eq(schema.users.shopId, shopId));

  const [{ intakeVolume }] = await db
    .select({ intakeVolume: sql<number>`count(*)::int` })
    .from(schema.tires)
    .where(and(eq(schema.tires.shopId, shopId), gte(schema.tires.createdAt, windowStart)));

  const [{ salesActivity }] = await db
    .select({ salesActivity: sql<number>`count(*)::int` })
    .from(schema.invoices)
    .where(
      and(
        eq(schema.invoices.shopId, shopId),
        eq(schema.invoices.status, 'paid'),
        gte(schema.invoices.paidAt, windowStart),
      ),
    );

  // payment-failed: most recent invoice that landed in the window with a non-paid terminal state
  const recentFailedRows = await db
    .select({ status: schema.invoices.status })
    .from(schema.invoices)
    .where(and(eq(schema.invoices.shopId, shopId), gte(schema.invoices.createdAt, windowStart)))
    .orderBy(desc(schema.invoices.createdAt))
    .limit(1);
  const paymentFailed = recentFailedRows[0]?.status === 'void';

  /* ---------- compute ---------- */
  const result = computeHealth({
    daysSinceLastLogin: daysBetween(lastLogin ? new Date(lastLogin) : null, now),
    intakeVolume28d: intakeVolume,
    salesActivity28d: salesActivity,
    paymentFailed,
    supportFlags: 0, // wired when support ticket schema lands
  });

  /* ---------- look up prior band for alert emission ---------- */
  const prior = await db.query.healthSignals.findFirst({
    where: eq(schema.healthSignals.shopId, shopId),
    orderBy: (h, { desc: d }) => [d(h.period)],
  });

  /* ---------- upsert today's snapshot ---------- */
  await db
    .insert(schema.healthSignals)
    .values({
      shopId,
      period,
      loginFrequency: result.parts.loginRecency,
      intakeVolume,
      salesActivity,
      daysSinceLastActivity: daysBetween(lastLogin ? new Date(lastLogin) : null, now),
      paymentStatus: paymentFailed ? 'failed' : 'ok',
      supportFlags: 0,
      computedScore: result.score,
      band: result.band,
    })
    .onConflictDoUpdate({
      target: [schema.healthSignals.shopId, schema.healthSignals.period],
      set: {
        loginFrequency: result.parts.loginRecency,
        intakeVolume,
        salesActivity,
        daysSinceLastActivity: daysBetween(lastLogin ? new Date(lastLogin) : null, now),
        paymentStatus: paymentFailed ? 'failed' : 'ok',
        supportFlags: 0,
        computedScore: result.score,
        band: result.band,
      },
    });

  /* ---------- mirror to shops.* ---------- */
  await db
    .update(schema.shops)
    .set({
      healthScore: result.score,
      healthBand: result.band,
      healthUpdatedAt: now,
    })
    .where(eq(schema.shops.id, shopId));

  /* ---------- Module 17 alert emission on band downgrade ---------- */
  let alertEmitted = false;
  if (prior && BAND_RANK[result.band] < BAND_RANK[prior.band as HealthBand]) {
    const type = result.score === 0 ? 'dormant' : 'churn_risk';
    const severity = result.band === 'red' ? 3 : 2;
    // Read attributed agent (if any) to route the alert.
    const shop = await db.query.shops.findFirst({ where: eq(schema.shops.id, shopId) });
    await db.insert(schema.accountAlerts).values({
      shopId,
      agentId: shop?.attributedAgentId ?? null,
      type,
      severity,
      message: `Health ${prior.band}→${result.band} (score ${prior.computedScore}→${result.score})`,
      status: 'open',
    });
    alertEmitted = true;
  }

  return { shopId, period, score: result.score, band: result.band, alertEmitted };
}

export type AggregateAllResult = {
  scanned: number;
  results: AggregateOneResult[];
  alertsEmitted: number;
};

export async function aggregateHealthAll(now: Date = new Date()): Promise<AggregateAllResult> {
  const db = getDb();
  const shops = await db.query.shops.findMany({
    where: sql`${schema.shops.suspendedAt} IS NULL`,
  });
  const results: AggregateOneResult[] = [];
  for (const shop of shops) {
    results.push(await aggregateHealthForShop(shop.id, now));
  }
  return {
    scanned: shops.length,
    results,
    alertsEmitted: results.filter((r) => r.alertEmitted).length,
  };
}
