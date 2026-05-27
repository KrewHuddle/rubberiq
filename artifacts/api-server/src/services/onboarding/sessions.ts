/**
 * Module 18 — onboarding sessions (DB-backed).
 *
 * Lifecycle:
 *   1. start  → row at step='details' with optional agentId (sales-attributed onboarding)
 *   2. advance → validate payload for `expectedStep`, merge into data jsonb,
 *                bump step to nextStep(current). Refuses if step != expectedStep
 *                (prevents skips / replays).
 *   3. complete → only valid when step='invite_staff'. Creates shop, owner,
 *                 invited staff (each with a random temp password — caller
 *                 must relay OOB). If agentId set, calls assignShopToAgent so
 *                 the existing signup-commission path fires.
 *
 * Idempotency: complete is one-shot. Subsequent calls return the cached
 * shopId from session.data.completion.
 */
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { getDb, schema } from '@rubberiq/db';
import {
  STEP_SCHEMAS,
  isTerminal,
  nextStep,
  validatePayload,
  type Step,
  type StepPayload,
} from './steps.js';
import { assignShopToAgent } from '../sales/agents.js';

export type StartInput = {
  email?: string;
  agentId?: string;
};

export type SessionRow = typeof schema.onboardingSessions.$inferSelect;

export type CompletionRecord = {
  shopId: string;
  ownerUserId: string;
  ownerTempPassword: string;
  invitedUserIds: string[];
  inviteTempPasswords: Array<{ email: string; tempPassword: string }>;
  agentAssignment: {
    agentAccountId: string;
    commissionEventId: string | null;
    signupCommissionCents: number;
  } | null;
};

type SessionData = {
  details?: StepPayload['details'];
  agreement?: StepPayload['agreement'];
  payment?: StepPayload['payment'];
  config?: StepPayload['config'];
  invite_staff?: StepPayload['invite_staff'];
  completion?: CompletionRecord;
};

function randomTempPassword(): string {
  const bytes = new Uint8Array(18);
  globalThis.crypto.getRandomValues(bytes);
  return Buffer.from(bytes)
    .toString('base64')
    .replace(/[+/=]/g, (c) => (c === '+' ? '-' : c === '/' ? '_' : ''));
}

export async function startSession(input: StartInput = {}): Promise<SessionRow> {
  const db = getDb();
  const [row] = await db
    .insert(schema.onboardingSessions)
    .values({
      step: 'details',
      email: input.email,
      agentId: input.agentId,
      data: {},
    })
    .returning();
  return row;
}

export async function getSession(id: string): Promise<SessionRow | null> {
  const db = getDb();
  const row = await db.query.onboardingSessions.findFirst({
    where: eq(schema.onboardingSessions.id, id),
  });
  return row ?? null;
}

export async function advanceStep<S extends keyof typeof STEP_SCHEMAS>(
  id: string,
  expectedStep: S,
  payload: unknown,
): Promise<SessionRow> {
  const db = getDb();
  const session = await getSession(id);
  if (!session) throw new Error('session_not_found');
  if (session.completedAt) throw new Error('session_already_completed');
  if (session.step !== expectedStep) throw new Error(`step_mismatch:want=${expectedStep},have=${session.step}`);

  const parsed = validatePayload(expectedStep, payload);
  const next = nextStep(expectedStep as Step);
  const data = { ...((session.data as SessionData | null) ?? {}), [expectedStep]: parsed };

  const [updated] = await db
    .update(schema.onboardingSessions)
    .set({ step: next, data })
    .where(eq(schema.onboardingSessions.id, id))
    .returning();
  return updated;
}

export async function completeOnboarding(
  id: string,
): Promise<{ session: SessionRow; completion: CompletionRecord }> {
  const db = getDb();
  const session = await getSession(id);
  if (!session) throw new Error('session_not_found');
  if (isTerminal(session.step as Step) && session.completedAt) {
    const data = session.data as SessionData | null;
    if (data?.completion) return { session, completion: data.completion };
  }
  if (session.step !== 'invite_staff') throw new Error(`step_mismatch:want=invite_staff,have=${session.step}`);

  const data = (session.data as SessionData | null) ?? {};
  if (!data.details) throw new Error('missing_details');

  /* ---- create shop ---- */
  const detailsPayload = data.details;
  const cfg = data.config;
  const [shop] = await db
    .insert(schema.shops)
    .values({
      name: detailsPayload.shopName,
      slug: detailsPayload.slug,
      state: detailsPayload.state,
      addressLine1: detailsPayload.addressLine1,
      city: detailsPayload.city,
      postalCode: detailsPayload.postalCode,
      defaultLanguage: detailsPayload.defaultLanguage,
      stripeAccountId: data.payment?.stripeAccountId,
      stripeConnectStatus: data.payment?.stripeConnectStatus,
      subscriptionStatus: 'trial',
      disposalFeeCents: cfg?.disposalFeeCents ?? 300,
      pricingFloorMarginBps: cfg?.pricingFloorMarginBps ?? 2000,
      branding: cfg?.branding,
    })
    .returning({ id: schema.shops.id });

  /* ---- create owner ---- */
  const ownerTempPassword = randomTempPassword();
  const [owner] = await db
    .insert(schema.users)
    .values({
      shopId: shop.id,
      name: detailsPayload.ownerName,
      email: detailsPayload.ownerEmail,
      passwordHash: await bcrypt.hash(ownerTempPassword, 12),
      role: 'owner',
      language: detailsPayload.defaultLanguage,
    })
    .returning({ id: schema.users.id });

  /* ---- create invited staff ---- */
  const invitedUserIds: string[] = [];
  const inviteTempPasswords: Array<{ email: string; tempPassword: string }> = [];
  for (const invite of data.invite_staff?.invites ?? []) {
    if (invite.email === detailsPayload.ownerEmail) continue; // owner already created
    const tempPassword = randomTempPassword();
    const [u] = await db
      .insert(schema.users)
      .values({
        shopId: shop.id,
        name: invite.name,
        email: invite.email,
        passwordHash: await bcrypt.hash(tempPassword, 12),
        role: invite.role,
        language: invite.language,
      })
      .returning({ id: schema.users.id });
    invitedUserIds.push(u.id);
    inviteTempPasswords.push({ email: invite.email, tempPassword });
  }

  /* ---- attribute to sales agent if present ---- */
  let agentAssignment: CompletionRecord['agentAssignment'] = null;
  if (session.agentId) {
    const r = await assignShopToAgent({ agentId: session.agentId, shopId: shop.id });
    agentAssignment = {
      agentAccountId: r.agentAccountId,
      commissionEventId: r.commissionEventId,
      signupCommissionCents: r.signupCommissionCents,
    };
  }

  const completion: CompletionRecord = {
    shopId: shop.id,
    ownerUserId: owner.id,
    ownerTempPassword,
    invitedUserIds,
    inviteTempPasswords,
    agentAssignment,
  };

  const [updated] = await db
    .update(schema.onboardingSessions)
    .set({
      step: 'done',
      shopId: shop.id,
      completedAt: new Date(),
      data: { ...data, completion },
    })
    .where(eq(schema.onboardingSessions.id, id))
    .returning();

  return { session: updated, completion };
}
