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
 * Directories — haulers + facilities
 * ========================================================== */

adminRouter.get('/haulers', async (_req, res) => {
  const db = getDb();
  const haulers = await db.query.haulers.findMany();
  res.json({ haulers });
});

adminRouter.get('/facilities', async (_req, res) => {
  const db = getDb();
  const facilities = await db.query.destinationFacilities.findMany();
  res.json({ facilities });
});

adminRouter.use((_req, res) => res.status(404).json({ error: 'not_found' }));
