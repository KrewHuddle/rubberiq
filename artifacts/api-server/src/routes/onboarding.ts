/**
 * Electronic onboarding routes (Module 18).
 *
 * Linear state machine: details → agreement → payment → config →
 * invite_staff → done. Public start (sales agents and direct shop signup both
 * hit this), id-gated read/advance/complete (UUID is the bearer).
 *
 * Completion creates the shop + owner + invited staff, returns a one-shot
 * payload with temp passwords. If the session carries an agentId, it also
 * invokes assignShopToAgent so the existing signup-commission path fires.
 */
import { Router } from 'express';
import { z, ZodError } from 'zod';
import {
  advanceStep,
  completeOnboarding,
  getSession,
  startSession,
} from '../services/onboarding/sessions.js';

export const onboardingRouter: Router = Router();

const StartBody = z.object({
  email: z.string().email().optional(),
  agentId: z.string().uuid().optional(),
});

onboardingRouter.post('/start', async (req, res) => {
  const parse = StartBody.safeParse(req.body ?? {});
  if (!parse.success) return res.status(400).json({ error: 'bad_request', issues: parse.error.issues });
  const session = await startSession(parse.data);
  return res.status(201).json({ id: session.id, step: session.step });
});

onboardingRouter.get('/:id', async (req, res) => {
  const session = await getSession(String(req.params.id));
  if (!session) return res.status(404).json({ error: 'not_found' });
  return res.json({
    id: session.id,
    step: session.step,
    completedAt: session.completedAt,
    shopId: session.shopId,
    data: session.data,
  });
});

const AdvanceBody = z.object({
  step: z.enum(['details', 'agreement', 'payment', 'config', 'invite_staff']),
  payload: z.unknown(),
});

onboardingRouter.post('/:id/advance', async (req, res) => {
  const parse = AdvanceBody.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'bad_request', issues: parse.error.issues });
  try {
    const updated = await advanceStep(String(req.params.id), parse.data.step, parse.data.payload);
    return res.json({ id: updated.id, step: updated.step });
  } catch (e) {
    if (e instanceof ZodError) {
      return res.status(400).json({ error: 'payload_invalid', issues: e.issues });
    }
    const msg = e instanceof Error ? e.message : 'internal_error';
    if (msg === 'session_not_found') return res.status(404).json({ error: msg });
    if (msg === 'session_already_completed') return res.status(409).json({ error: msg });
    if (msg.startsWith('step_mismatch:')) return res.status(409).json({ error: msg });
    throw e;
  }
});

onboardingRouter.post('/:id/complete', async (req, res) => {
  try {
    const { session, completion } = await completeOnboarding(String(req.params.id));
    return res.status(201).json({
      id: session.id,
      step: session.step,
      shopId: session.shopId,
      completion,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'internal_error';
    if (msg === 'session_not_found') return res.status(404).json({ error: msg });
    if (msg.startsWith('step_mismatch:')) return res.status(409).json({ error: msg });
    if (msg === 'missing_details') return res.status(409).json({ error: msg });
    throw e;
  }
});
