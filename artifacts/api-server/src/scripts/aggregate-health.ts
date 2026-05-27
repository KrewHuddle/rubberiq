/**
 * Module 16 — health aggregator CLI runner.
 *
 * Run via pnpm:
 *   DATABASE_URL=postgres://... pnpm --filter @rubberiq/api-server health:aggregate
 *
 * Or via the compiled bundle in prod (DO App scheduled job, GH Action cron, etc.):
 *   node dist/scripts/aggregate-health.js
 *
 * Output: one line per shop scanned, plus a tail summary. Non-zero exit on
 * partial failure (any shop throws) so a cron caller can alarm.
 */
import { getPool } from '@rubberiq/db';
import { aggregateHealthAll } from '../services/health/aggregate.js';

async function main(): Promise<void> {
  const startedAt = Date.now();
  const result = await aggregateHealthAll();

  for (const r of result.results) {
    const flag = r.alertEmitted ? ' [ALERT]' : '';
    console.log(`  ${r.shopId.slice(0, 8)}  period=${r.period}  score=${r.score}  band=${r.band}${flag}`);
  }
  console.log(
    `aggregateHealthAll: scanned=${result.scanned} alerts=${result.alertsEmitted} took=${Date.now() - startedAt}ms`,
  );
}

main()
  .then(async () => {
    await getPool().end();
    process.exit(0);
  })
  .catch(async (err: unknown) => {
    console.error('aggregate-health failed:', err);
    try {
      await getPool().end();
    } catch {
      /* ignore */
    }
    process.exit(1);
  });
