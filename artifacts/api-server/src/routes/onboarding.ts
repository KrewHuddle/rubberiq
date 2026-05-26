/**
 * Electronic onboarding (§19, Module 19).
 * Session-driven: details -> agreement -> payment -> config -> invite_staff -> done.
 * Completion triggers signup commission + residual clock + agentAccounts row (Module 15).
 */
import { Router } from 'express';

export const onboardingRouter: Router = Router();

onboardingRouter.post('/start', (_req, res) => {
  res.status(501).json({ error: 'not_implemented', module: 19 });
});

onboardingRouter.get('/:id', (_req, res) => {
  res.status(501).json({ error: 'not_implemented', module: 19 });
});

onboardingRouter.post('/:id/advance', (_req, res) => {
  res.status(501).json({ error: 'not_implemented', module: 19 });
});
