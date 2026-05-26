/**
 * Sentry instrumentation entry — MUST be imported via `--import` before any
 * other module so async hooks fire correctly.
 *
 *   node --import ./dist/instrument.js dist/index.js
 *   tsx watch --import ./src/instrument.ts src/index.ts
 */
import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'development',
    release: process.env.SENTRY_RELEASE,
    integrations: [nodeProfilingIntegration()],
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    profilesSampleRate: 1.0,
    sendDefaultPii: false,
  });
}
