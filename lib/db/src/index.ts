import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema.js';

const { Pool } = pg;

let _pool: pg.Pool | null = null;
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getPool(): pg.Pool {
  if (!_pool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL not set');
    _pool = new Pool(buildPoolConfig(url));
  }
  return _pool;
}

/**
 * Build pg.Pool config from a Postgres URL.
 *
 * Why parse manually instead of passing `connectionString`:
 * pg's connection-string parser sets `ssl: true` (strict verify) on
 * `sslmode=require` and that wins over an explicit `ssl` Pool option in some
 * versions — causing SELF_SIGNED_CERT_IN_CHAIN against DO Managed Postgres.
 * We parse the URL and set `ssl: { rejectUnauthorized: false }` explicitly
 * whenever the URL signals managed SSL.
 */
export function buildPoolConfig(url: string): pg.PoolConfig {
  const u = new URL(url);
  const sslmode = u.searchParams.get('sslmode');
  const ssl =
    sslmode === 'require' || sslmode === 'verify-ca' || sslmode === 'verify-full'
      ? { rejectUnauthorized: false }
      : undefined;
  return {
    host: u.hostname,
    port: u.port ? Number(u.port) : 5432,
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, ''),
    ssl,
  };
}

export function getDb() {
  if (!_db) {
    _db = drizzle(getPool(), { schema, casing: 'snake_case' });
  }
  return _db;
}

export * as schema from './schema.js';
export type DB = ReturnType<typeof getDb>;
