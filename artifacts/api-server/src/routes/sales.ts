/**
 * Sales-agent routes (§14) — scoped to req.principal.agentId.
 * super_admin sees all; sales_agent sees only own book.
 */
import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { getDb, schema } from '@rubberiq/db';
import { requireSalesAgent, type PlatformPrincipal } from '../auth.js';

export const salesRouter: Router = Router();

salesRouter.use(requireSalesAgent());

function selfAgentId(req: import('express').Request): string | undefined {
  const p = req.principal as PlatformPrincipal;
  return p.agentId;
}

salesRouter.get('/accounts', async (req, res) => {
  const db = getDb();
  const agentId = selfAgentId(req);
  if (!agentId) return res.json({ accounts: [] });
  const accounts = await db.query.agentAccounts.findMany({
    where: eq(schema.agentAccounts.agentId, agentId),
  });
  return res.json({ accounts });
});

salesRouter.get('/commissions', async (req, res) => {
  const db = getDb();
  const agentId = selfAgentId(req);
  if (!agentId) return res.json({ events: [] });
  const events = await db.query.commissionEvents.findMany({
    where: eq(schema.commissionEvents.agentId, agentId),
    orderBy: (c, { desc }) => [desc(c.createdAt)],
  });
  return res.json({ events });
});

salesRouter.get('/alerts', async (req, res) => {
  const db = getDb();
  const agentId = selfAgentId(req);
  if (!agentId) return res.json({ alerts: [] });
  const alerts = await db.query.accountAlerts.findMany({
    where: eq(schema.accountAlerts.agentId, agentId),
    orderBy: (a, { desc }) => [desc(a.createdAt)],
  });
  return res.json({ alerts });
});

salesRouter.get('/me/goals', async (req, res) => {
  const db = getDb();
  const agentId = selfAgentId(req);
  if (!agentId) return res.json({ goals: null });
  const agent = await db.query.salesAgents.findFirst({
    where: eq(schema.salesAgents.id, agentId),
  });
  return res.json({ goals: agent?.goalConfig ?? null });
});

salesRouter.post('/demo/start', (_req, res) => {
  res.status(501).json({ error: 'not_implemented', module: 18 });
});

salesRouter.post('/demo/reset', (_req, res) => {
  res.status(501).json({ error: 'not_implemented', module: 18 });
});
