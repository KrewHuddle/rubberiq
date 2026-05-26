/**
 * Sales-agent admin service (Module 14).
 *
 * Create-agent flow:
 *   1. Caller (super-admin) submits name + email + territory (+ optional commissionPlanId)
 *   2. Creates platform_users row (role=sales_agent) with temp password
 *   3. Creates sales_agents row linking platformUserId
 *   4. Returns ids + temp password (caller relays to agent OOB; real invite email later)
 *
 * Assign-shop flow:
 *   1. Caller picks agentId + shopId
 *   2. Verifies both exist; refuses if shop already attributed
 *   3. Creates agent_accounts row + sets shops.attributedAgentId
 *   4. Emits a signup commission_event from the agent's plan (if attached)
 */
import bcrypt from 'bcryptjs';
import { and, eq } from 'drizzle-orm';
import { getDb, schema } from '@rubberiq/db';
import {
  computeSignupCents,
  type SignupRate,
} from './commission.js';

export type CreateAgentInput = {
  name: string;
  email: string;
  territory?: string;
  commissionPlanId?: string;
  /** If absent, a random 16-byte hex temp password is generated. */
  tempPassword?: string;
};

export type CreateAgentResult = {
  agentId: string;
  platformUserId: string;
  tempPassword: string;
  created: boolean;
};

function randomTempPassword(): string {
  // 24 chars base64 — enough entropy, copy-pasteable
  const bytes = new Uint8Array(18);
  globalThis.crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString('base64').replace(/[+/=]/g, (c) =>
    c === '+' ? '-' : c === '/' ? '_' : '',
  );
}

export async function createAgent(input: CreateAgentInput): Promise<CreateAgentResult> {
  const db = getDb();

  const existing = await db.query.platformUsers.findFirst({
    where: eq(schema.platformUsers.email, input.email),
  });
  if (existing) {
    const ex = await db.query.salesAgents.findFirst({
      where: eq(schema.salesAgents.platformUserId, existing.id),
    });
    if (ex)
      return {
        agentId: ex.id,
        platformUserId: existing.id,
        tempPassword: '<existing — not rotated>',
        created: false,
      };
    // Email taken by a non-agent platform user — refuse.
    throw new Error('email_taken_by_non_agent');
  }

  const tempPassword = input.tempPassword ?? randomTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 12);

  const [pu] = await db
    .insert(schema.platformUsers)
    .values({
      name: input.name,
      email: input.email,
      passwordHash,
      role: 'sales_agent',
      language: 'en',
    })
    .returning({ id: schema.platformUsers.id });

  const [agent] = await db
    .insert(schema.salesAgents)
    .values({
      platformUserId: pu.id,
      name: input.name,
      territory: input.territory,
      commissionPlanId: input.commissionPlanId,
    })
    .returning({ id: schema.salesAgents.id });

  return {
    agentId: agent.id,
    platformUserId: pu.id,
    tempPassword,
    created: true,
  };
}

export type AssignShopInput = {
  agentId: string;
  shopId: string;
};

export type AssignShopResult = {
  agentAccountId: string;
  commissionEventId: string | null;
  signupCommissionCents: number;
  created: boolean;
};

export async function assignShopToAgent(input: AssignShopInput): Promise<AssignShopResult> {
  const db = getDb();

  const agent = await db.query.salesAgents.findFirst({
    where: eq(schema.salesAgents.id, input.agentId),
  });
  if (!agent) throw new Error('agent_not_found');

  const shop = await db.query.shops.findFirst({ where: eq(schema.shops.id, input.shopId) });
  if (!shop) throw new Error('shop_not_found');

  const existing = await db.query.agentAccounts.findFirst({
    where: and(
      eq(schema.agentAccounts.agentId, input.agentId),
      eq(schema.agentAccounts.shopId, input.shopId),
    ),
  });
  if (existing) {
    return {
      agentAccountId: existing.id,
      commissionEventId: null,
      signupCommissionCents: 0,
      created: false,
    };
  }

  if (shop.attributedAgentId && shop.attributedAgentId !== input.agentId) {
    throw new Error('shop_already_attributed');
  }

  const [acct] = await db
    .insert(schema.agentAccounts)
    .values({ agentId: input.agentId, shopId: input.shopId })
    .returning({ id: schema.agentAccounts.id });

  await db
    .update(schema.shops)
    .set({ attributedAgentId: input.agentId })
    .where(eq(schema.shops.id, input.shopId));

  let signupCommissionCents = 0;
  let commissionEventId: string | null = null;
  if (agent.commissionPlanId) {
    const plan = await db.query.commissionPlans.findFirst({
      where: eq(schema.commissionPlans.id, agent.commissionPlanId),
    });
    if (plan) {
      // shops table doesn't yet store the subscription monthly rate — assume
      // the default published rate ($149/shop/month single-bay). Future
      // enhancement: read from shops.subscriptionRateCents once that lands.
      const DEFAULT_MONTHLY_CENTS = 14_900;
      signupCommissionCents = computeSignupCents(
        { signupRate: plan.signupRate as SignupRate },
        DEFAULT_MONTHLY_CENTS,
      );
      const [evt] = await db
        .insert(schema.commissionEvents)
        .values({
          agentId: input.agentId,
          shopId: input.shopId,
          type: 'signup',
          basisCents:
            plan.signupRate.kind === 'flat'
              ? plan.signupRate.amountCents
              : DEFAULT_MONTHLY_CENTS * plan.signupRate.ofMonths,
          rateAppliedBps: plan.signupRate.kind === 'percent' ? plan.signupRate.bps : null,
          amountEarnedCents: signupCommissionCents,
          period: new Date().toISOString().slice(0, 10),
        })
        .returning({ id: schema.commissionEvents.id });
      commissionEventId = evt.id;

      await db
        .update(schema.agentAccounts)
        .set({ signupCommissionPaid: true })
        .where(eq(schema.agentAccounts.id, acct.id));
    }
  }

  return {
    agentAccountId: acct.id,
    commissionEventId,
    signupCommissionCents,
    created: true,
  };
}
