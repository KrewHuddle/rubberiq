import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import { buildPoolConfig } from './index.js';

const { Pool } = pg;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set');

  const pool = new Pool(buildPoolConfig(url));
  const db = drizzle(pool);
  await migrate(db, { migrationsFolder: './migrations' });
  await pool.end();
  console.log('migrations complete');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
