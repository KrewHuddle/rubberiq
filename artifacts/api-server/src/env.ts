import { z } from 'zod';

const Env = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  ANTHROPIC_API_KEY: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_CONNECT_CLIENT_ID: z.string().optional(),
  SENTRY_DSN: z.string().optional(),
  SENTRY_RELEASE: z.string().optional(),
  WEB_ORIGIN: z.string().default('http://localhost:5173'),
});

export const env = Env.parse(process.env);
export type AppEnv = z.infer<typeof Env>;
