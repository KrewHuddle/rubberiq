/**
 * Super-admin routes (§13a) — Guru Boxz internal.
 * Tenant management, cross-shop metrics, sales-management, verified directories.
 * All routes require platform role super_admin.
 */
import { Router } from 'express';
import { z } from 'zod';
import { eq, sql } from 'drizzle-orm';
import { requirePlatform } from '../auth.js';
import { getDb, schema } from '@rubberiq/db';
import { createAgent, assignShopToAgent } from '../services/sales/agents.js';
import {
  getPickupQueue,
  getScrapVolumeMap,
  createRoute,
  listRoutes,
  getRoute,
  advanceRoute,
  reconcileRoute,
} from '../services/disposal/dispatch.js';

export const adminRouter: Router = Router();

adminRouter.use(requirePlatform('super_admin'));

/** Default monthly subscription used to compute MRR until shops.subscriptionRateCents lands. */
const DEFAULT_SUBSCRIPTION_CENTS = 14_900;

adminRouter.get('/stats', async (_req, res) => {
  const db = getDb();
  const [shopsLive] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.shops)
    .where(sql`${schema.shops.subscriptionStatus} <> 'cancelled' AND ${schema.shops.suspendedAt} IS NULL`);
  const [tiresLogged] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.tires);
  const [scrapHauled] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.scrapTires)
    .where(sql`${schema.scrapTires.status} = 'delivered'`);
  const [agentsActive] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.salesAgents);
  const live = shopsLive?.n ?? 0;
  return res.json({
    shopsLive: live,
    mrrCents: live * DEFAULT_SUBSCRIPTION_CENTS,
    tiresLogged: tiresLogged?.n ?? 0,
    scrapHauled: scrapHauled?.n ?? 0,
    agentsActive: agentsActive?.n ?? 0,
  });
});

adminRouter.get('/shops', async (_req, res) => {
  const db = getDb();
  const shops = await db.query.shops.findMany({ orderBy: (s, { desc }) => [desc(s.createdAt)] });
  res.json({ shops });
});

/* ============================================================
 * Module 14 — sales agents
 * ========================================================== */

adminRouter.get('/agents', async (_req, res) => {
  const db = getDb();
  const agents = await db.query.salesAgents.findMany({
    orderBy: (a, { desc }) => [desc(a.createdAt)],
  });
  res.json({ agents });
});

const CreateAgentBody = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  territory: z.string().max(120).optional(),
  commissionPlanId: z.string().uuid().optional(),
});

adminRouter.post('/agents', async (req, res) => {
  const parse = CreateAgentBody.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'bad_request', issues: parse.error.issues });
  try {
    const result = await createAgent(parse.data);
    return res.status(result.created ? 201 : 200).json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'internal_error';
    if (msg === 'email_taken_by_non_agent') return res.status(409).json({ error: msg });
    throw e;
  }
});

adminRouter.get('/agents/:id/accounts', async (req, res) => {
  const agentId = String(req.params.id);
  const db = getDb();
  const accounts = await db.query.agentAccounts.findMany({
    where: eq(schema.agentAccounts.agentId, agentId),
    orderBy: (a, { desc }) => [desc(a.signedAt)],
  });
  return res.json({ accounts });
});

const AssignShopBody = z.object({
  shopId: z.string().uuid(),
});

adminRouter.post('/agents/:id/assign', async (req, res) => {
  const agentId = String(req.params.id);
  const parse = AssignShopBody.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'bad_request', issues: parse.error.issues });
  try {
    const result = await assignShopToAgent({ agentId, shopId: parse.data.shopId });
    return res.status(result.created ? 201 : 200).json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'internal_error';
    if (msg === 'agent_not_found' || msg === 'shop_not_found')
      return res.status(404).json({ error: msg });
    if (msg === 'shop_already_attributed') return res.status(409).json({ error: msg });
    throw e;
  }
});

/* ============================================================
 * Commission plans
 * ========================================================== */

const SignupRateSchema = z.union([
  z.object({ kind: z.literal('flat'), amountCents: z.number().int().min(0) }),
  z.object({
    kind: z.literal('percent'),
    bps: z.number().int().min(0).max(20_000),
    ofMonths: z.number().int().min(1).max(36),
  }),
]);

const CreateCommissionPlanBody = z.object({
  name: z.string().min(2).max(120),
  signupRate: SignupRateSchema,
  residualRateBps: z.number().int().min(0).max(10_000),
  residualTerm: z.string().regex(/^(life|\d{1,3})$/),
  upsellRateBps: z.number().int().min(0).max(10_000).default(1000),
  upsellAttribution: z.enum(['upseller', 'signer', 'split']).default('upseller'),
});

adminRouter.get('/commission-plans', async (_req, res) => {
  const db = getDb();
  const plans = await db.query.commissionPlans.findMany({
    orderBy: (p, { desc }) => [desc(p.createdAt)],
  });
  res.json({ plans });
});

adminRouter.post('/commission-plans', async (req, res) => {
  const parse = CreateCommissionPlanBody.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'bad_request', issues: parse.error.issues });
  const db = getDb();
  const [plan] = await db
    .insert(schema.commissionPlans)
    .values(parse.data)
    .returning({ id: schema.commissionPlans.id });
  return res.status(201).json({ planId: plan.id });
});

adminRouter.get('/commissions', async (req, res) => {
  const db = getDb();
  const agentId = typeof req.query.agentId === 'string' ? req.query.agentId : undefined;
  const events = agentId
    ? await db.query.commissionEvents.findMany({
        where: eq(schema.commissionEvents.agentId, agentId),
        orderBy: (c, { desc }) => [desc(c.createdAt)],
        limit: 500,
      })
    : await db.query.commissionEvents.findMany({
        orderBy: (c, { desc }) => [desc(c.createdAt)],
        limit: 500,
      });
  return res.json({ events });
});

/* ============================================================
 * Account health + alerts (Module 16/17)
 * ========================================================== */

adminRouter.get('/health', async (req, res) => {
  const db = getDb();
  const shopId = typeof req.query.shopId === 'string' ? req.query.shopId : undefined;
  const rows = shopId
    ? await db.query.healthSignals.findMany({
        where: eq(schema.healthSignals.shopId, shopId),
        orderBy: (h, { desc }) => [desc(h.period)],
        limit: 52,
      })
    : await db.query.healthSignals.findMany({
        orderBy: (h, { desc }) => [desc(h.createdAt)],
        limit: 200,
      });
  return res.json({ signals: rows });
});

adminRouter.get('/alerts', async (_req, res) => {
  const db = getDb();
  const alerts = await db.query.accountAlerts.findMany({
    orderBy: (a, { desc }) => [desc(a.createdAt)],
    limit: 500,
  });
  res.json({ alerts });
});

/* ============================================================
 * Directories — haulers + facilities (Module 12c)
 *
 * `verified` is the operational gate: dispatch refuses to build a route on an
 * unverified hauler or facility. Verification means a human confirmed the NC
 * DEQ scrap-tire hauler registration / PA DEP Act 90 transporter authorization
 * and the destination facility's disposal permit.
 * ========================================================== */

adminRouter.get('/haulers', async (_req, res) => {
  const db = getDb();
  const haulers = await db.query.haulers.findMany({
    orderBy: (h, { desc }) => [desc(h.createdAt)],
  });
  res.json({ haulers });
});

const HaulerBody = z.object({
  name: z.string().min(2).max(160),
  state: z.string().length(2),
  permitNumber: z.string().max(80).optional(),
  permitExpiresOn: z.string().datetime().optional(),
  contactName: z.string().max(120).optional(),
  contactPhone: z.string().max(40).optional(),
  contactEmail: z.string().email().optional(),
  truckCapacity: z.number().int().min(1).max(10_000).optional(),
  verified: z.boolean().optional(),
});

adminRouter.post('/haulers', async (req, res) => {
  const parse = HaulerBody.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'bad_request', issues: parse.error.issues });
  const db = getDb();
  const { permitExpiresOn, ...rest } = parse.data;
  const [hauler] = await db
    .insert(schema.haulers)
    .values({ ...rest, permitExpiresOn: permitExpiresOn ? new Date(permitExpiresOn) : undefined })
    .returning({ id: schema.haulers.id });
  return res.status(201).json({ haulerId: hauler.id });
});

adminRouter.patch('/haulers/:id', async (req, res) => {
  const parse = HaulerBody.partial().safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'bad_request', issues: parse.error.issues });
  const db = getDb();
  const { permitExpiresOn, ...rest } = parse.data;
  const [row] = await db
    .update(schema.haulers)
    .set({ ...rest, ...(permitExpiresOn ? { permitExpiresOn: new Date(permitExpiresOn) } : {}) })
    .where(eq(schema.haulers.id, String(req.params.id)))
    .returning({ id: schema.haulers.id });
  if (!row) return res.status(404).json({ error: 'hauler_not_found' });
  return res.json({ ok: true });
});

adminRouter.get('/facilities', async (_req, res) => {
  const db = getDb();
  const facilities = await db.query.destinationFacilities.findMany({
    orderBy: (f, { desc }) => [desc(f.createdAt)],
  });
  res.json({ facilities });
});

const FacilityBody = z.object({
  name: z.string().min(2).max(160),
  state: z.string().length(2),
  permitNumber: z.string().max(80).optional(),
  permitExpiresOn: z.string().datetime().optional(),
  addressLine1: z.string().max(200).optional(),
  city: z.string().max(120).optional(),
  postalCode: z.string().max(20).optional(),
  permitCopyUrl: z.string().url().max(500).optional(),
  verified: z.boolean().optional(),
});

adminRouter.post('/facilities', async (req, res) => {
  const parse = FacilityBody.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'bad_request', issues: parse.error.issues });
  const db = getDb();
  const { permitExpiresOn, ...rest } = parse.data;
  const [facility] = await db
    .insert(schema.destinationFacilities)
    .values({ ...rest, permitExpiresOn: permitExpiresOn ? new Date(permitExpiresOn) : undefined })
    .returning({ id: schema.destinationFacilities.id });
  return res.status(201).json({ facilityId: facility.id });
});

adminRouter.patch('/facilities/:id', async (req, res) => {
  const parse = FacilityBody.partial().safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'bad_request', issues: parse.error.issues });
  const db = getDb();
  const { permitExpiresOn, ...rest } = parse.data;
  const [row] = await db
    .update(schema.destinationFacilities)
    .set({ ...rest, ...(permitExpiresOn ? { permitExpiresOn: new Date(permitExpiresOn) } : {}) })
    .where(eq(schema.destinationFacilities.id, String(req.params.id)))
    .returning({ id: schema.destinationFacilities.id });
  if (!row) return res.status(404).json({ error: 'facility_not_found' });
  return res.json({ ok: true });
});

/* ============================================================
 * Disposal service dispatch (Module 12b) — the second revenue stream.
 *
 * The platform reads scrap-on-hand across every shop as a demand signal,
 * batches it into truck runs ("tires until full"), and reconciles disposal
 * fees collected against the hauler's cost to produce a per-run margin.
 * ========================================================== */

/** Service errors that are the caller's fault, mapped to 400. */
const DISPATCH_BAD_REQUEST = new Set([
  'hauler_not_verified',
  'facility_not_verified',
  'invalid_capacity',
  'invalid_max_stops',
  'invalid_haul_cost',
  'no_scrap_available',
  'route_has_no_stops',
  'route_already_closed',
]);

function sendDispatchError(e: unknown, res: import('express').Response): boolean {
  const msg = e instanceof Error ? e.message : 'internal_error';
  if (msg === 'hauler_not_found' || msg === 'facility_not_found' || msg === 'route_not_found') {
    res.status(404).json({ error: msg });
    return true;
  }
  if (DISPATCH_BAD_REQUEST.has(msg)) {
    res.status(400).json({ error: msg });
    return true;
  }
  return false;
}

adminRouter.get('/disposal/queue', async (req, res) => {
  const state = typeof req.query.state === 'string' ? req.query.state : undefined;
  const queue = await getPickupQueue({ state });
  return res.json({ queue });
});

adminRouter.get('/disposal/scrap-map', async (_req, res) => {
  const map = await getScrapVolumeMap();
  return res.json({ map });
});

const CreateRouteBody = z.object({
  haulerId: z.string().uuid(),
  destinationFacilityId: z.string().uuid(),
  capacity: z.number().int().min(1).max(10_000).optional(),
  state: z.string().length(2).optional(),
  maxStops: z.number().int().min(1).max(100).optional(),
  allowPartial: z.boolean().optional(),
  scheduledFor: z
    .string()
    .datetime()
    .refine((s) => new Date(s).getTime() >= Date.now() - 60_000, {
      message: 'scheduledFor must not be in the past',
    })
    .optional(),
});

adminRouter.post('/disposal/routes', async (req, res) => {
  const parse = CreateRouteBody.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'bad_request', issues: parse.error.issues });
  const principal = req.principal as { platformUserId?: string } | undefined;
  try {
    const result = await createRoute({
      ...parse.data,
      scheduledFor: parse.data.scheduledFor ? new Date(parse.data.scheduledFor) : undefined,
      createdByPlatformUserId: principal?.platformUserId,
    });
    return res.status(201).json(result);
  } catch (e) {
    if (sendDispatchError(e, res)) return;
    throw e;
  }
});

adminRouter.get('/disposal/routes', async (_req, res) => {
  const routes = await listRoutes();
  return res.json({ routes });
});

adminRouter.get('/disposal/routes/:id', async (req, res) => {
  try {
    const result = await getRoute(String(req.params.id));
    return res.json(result);
  } catch (e) {
    if (sendDispatchError(e, res)) return;
    throw e;
  }
});

const AdvanceRouteBody = z.object({
  to: z.enum(['in_transit', 'completed', 'cancelled']),
});

adminRouter.post('/disposal/routes/:id/advance', async (req, res) => {
  const parse = AdvanceRouteBody.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'bad_request', issues: parse.error.issues });
  try {
    const result = await advanceRoute(String(req.params.id), parse.data.to);
    return res.json(result);
  } catch (e) {
    if (sendDispatchError(e, res)) return;
    throw e;
  }
});

const ReconcileRouteBody = z.object({
  haulCostCents: z.number().int().min(0).max(100_000_000),
});

adminRouter.post('/disposal/routes/:id/reconcile', async (req, res) => {
  const parse = ReconcileRouteBody.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'bad_request', issues: parse.error.issues });
  try {
    const result = await reconcileRoute(String(req.params.id), parse.data.haulCostCents);
    return res.json(result);
  } catch (e) {
    if (sendDispatchError(e, res)) return;
    throw e;
  }
});

adminRouter.use((_req, res) => res.status(404).json({ error: 'not_found' }));
