/**
 * Auth routes — login/logout for shop users AND platform users.
 * Body shape decides which table is consulted.
 */
import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { eq, and } from 'drizzle-orm';
import { getDb, schema } from '@rubberiq/db';
import { signToken } from '../auth.js';

export const authRouter: Router = Router();

const LoginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  shopSlug: z.string().optional(), // present => shop user; absent => platform user
});

authRouter.post('/login', async (req, res) => {
  const parse = LoginBody.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'bad_request', issues: parse.error.issues });
  const { email, password, shopSlug } = parse.data;

  const db = getDb();

  if (shopSlug) {
    const shop = await db.query.shops.findFirst({ where: eq(schema.shops.slug, shopSlug) });
    if (!shop) return res.status(401).json({ error: 'invalid_credentials' });
    const user = await db.query.users.findFirst({
      where: and(eq(schema.users.shopId, shop.id), eq(schema.users.email, email)),
    });
    if (!user || user.disabledAt) return res.status(401).json({ error: 'invalid_credentials' });
    if (!(await bcrypt.compare(password, user.passwordHash)))
      return res.status(401).json({ error: 'invalid_credentials' });

    const token = signToken({
      kind: 'user',
      userId: user.id,
      shopId: shop.id,
      role: user.role,
      language: user.language,
    });
    return res.json({ token, principal: { kind: 'user', role: user.role, shopId: shop.id } });
  }

  const pu = await db.query.platformUsers.findFirst({
    where: eq(schema.platformUsers.email, email),
  });
  if (!pu || pu.disabledAt) return res.status(401).json({ error: 'invalid_credentials' });
  if (!(await bcrypt.compare(password, pu.passwordHash)))
    return res.status(401).json({ error: 'invalid_credentials' });

  let agentId: string | undefined;
  if (pu.role === 'sales_agent') {
    const agent = await db.query.salesAgents.findFirst({
      where: eq(schema.salesAgents.platformUserId, pu.id),
    });
    agentId = agent?.id;
  }

  const token = signToken({
    kind: 'platform',
    platformUserId: pu.id,
    role: pu.role,
    agentId,
    language: pu.language,
  });
  return res.json({ token, principal: { kind: 'platform', role: pu.role } });
});

authRouter.post('/logout', (_req, res) => {
  res.json({ ok: true });
});
