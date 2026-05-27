import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import * as Sentry from '@sentry/node';

import { env } from './env.js';
import { initI18n } from './i18n.js';
import { attachPrincipal } from './auth.js';
import { healthRouter } from './routes/health.js';
import { authRouter } from './routes/auth.js';
import { adminRouter } from './routes/admin.js';
import { shopRouter } from './routes/shop.js';
import { salesRouter } from './routes/sales.js';
import { intakeRouter } from './routes/intake.js';
import { onboardingRouter } from './routes/onboarding.js';

async function main(): Promise<void> {
  await initI18n();

  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(
    cors({
      origin: env.WEB_ORIGIN.split(',').map((s) => s.trim()),
      credentials: true,
    }),
  );
  app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));
  app.use(express.json({ limit: '8mb' })); // photo data URLs land here as base64 strings
  app.use(cookieParser());
  app.use(attachPrincipal);

  app.use('/', healthRouter);
  app.use(['/api/auth', '/auth'], authRouter);
  app.use(['/api/admin', '/admin'], adminRouter);
  app.use(['/api/shop', '/shop'], shopRouter);
  app.use(['/api/sales', '/sales'], salesRouter);
  app.use(['/api/tires/intake', '/tires/intake'], intakeRouter);
  app.use(['/api/onboarding', '/onboarding'], onboardingRouter);

  app.use((req, res) => res.status(404).json({ error: 'not_found', path: req.path }));

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    Sentry.captureException(err);
    const msg = err instanceof Error ? err.message : 'internal_error';
    res.status(500).json({ error: 'internal_error', message: msg });
  });

  app.listen(env.PORT, () => {
    console.log(`rubberiq-api listening on :${env.PORT} (${env.NODE_ENV})`);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
