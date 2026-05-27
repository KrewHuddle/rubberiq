/**
 * Module 18 — onboarding step machine (pure).
 *
 * Linear, no branches. Each step has a Zod payload schema. Advancing requires
 * that the caller is currently on `step` and supplies a payload that parses.
 *
 * Done is terminal — `completeOnboarding` (in sessions.ts) is what flips an
 * `invite_staff` session into `done` while creating the shop + owner.
 */
import { z } from 'zod';

export const STEP_ORDER = [
  'details',
  'agreement',
  'payment',
  'config',
  'invite_staff',
  'done',
] as const;

export type Step = (typeof STEP_ORDER)[number];

export const detailsSchema = z.object({
  shopName: z.string().min(2).max(120),
  slug: z
    .string()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/, 'lowercase letters, digits, hyphens only'),
  state: z.string().length(2),
  addressLine1: z.string().min(2).max(200).optional(),
  city: z.string().min(1).max(120).optional(),
  postalCode: z.string().min(3).max(12).optional(),
  defaultLanguage: z.enum(['en', 'es']).default('en'),
  ownerName: z.string().min(2).max(120),
  ownerEmail: z.string().email(),
});

export const agreementSchema = z.object({
  agreementVersion: z.string().min(1).max(20),
  signedName: z.string().min(2).max(120),
  pdfUrl: z.string().url().optional(),
});

export const paymentSchema = z.object({
  stripeAccountId: z.string().min(2).max(120),
  stripeConnectStatus: z.string().min(2).max(40).default('pending'),
});

export const configSchema = z.object({
  disposalFeeCents: z.number().int().min(0).max(10_000).default(300),
  pricingFloorMarginBps: z.number().int().min(0).max(10_000).default(2000),
  branding: z.record(z.unknown()).optional(),
});

export const inviteStaffSchema = z.object({
  invites: z
    .array(
      z.object({
        name: z.string().min(2).max(120),
        email: z.string().email(),
        role: z.enum(['owner', 'manager', 'counter', 'intake']),
        language: z.enum(['en', 'es']).default('en'),
      }),
    )
    .max(20)
    .default([]),
});

export const STEP_SCHEMAS = {
  details: detailsSchema,
  agreement: agreementSchema,
  payment: paymentSchema,
  config: configSchema,
  invite_staff: inviteStaffSchema,
} as const;

export type StepPayload = {
  details: z.infer<typeof detailsSchema>;
  agreement: z.infer<typeof agreementSchema>;
  payment: z.infer<typeof paymentSchema>;
  config: z.infer<typeof configSchema>;
  invite_staff: z.infer<typeof inviteStaffSchema>;
};

export function nextStep(current: Step): Step {
  const idx = STEP_ORDER.indexOf(current);
  if (idx < 0) throw new Error(`unknown_step:${current}`);
  if (idx === STEP_ORDER.length - 1) return 'done';
  return STEP_ORDER[idx + 1];
}

export function isTerminal(step: Step): boolean {
  return step === 'done';
}

/** Returns the (parsed) payload or throws a ZodError on bad input. */
export function validatePayload<S extends keyof typeof STEP_SCHEMAS>(
  step: S,
  payload: unknown,
): StepPayload[S] {
  const schema = STEP_SCHEMAS[step];
  return schema.parse(payload) as StepPayload[S];
}
