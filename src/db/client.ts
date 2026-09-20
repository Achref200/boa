import { Kysely, MysqlDialect } from 'kysely';
import { createPool, type PoolOptions } from 'mysql2';
import type { Database } from './types';
import { env } from '@/lib/env';

// TiDB Cloud Serverless (and other managed MySQL hosting) requires SSL.
// Detect it from the host name and enable SSL with rejectUnauthorized so the
// connection works without Shipping a CA certificate through environment
// variables. For a tighter setup, replace this with the CA path from the
// provider's dashboard.
function sslOptionsFor(uri: string): PoolOptions['ssl'] {
  // TiDB Cloud gateway host names look like:
  //   gateway01.<region>.prod.aws.tidbcloud.com
  // Add more patterns here if another managed host is used.
  const tidbHost = /gateway\d+\.[a-z0-9-]+\.prod\.aws\.tidbcloud\.com/.test(uri);
  if (tidbHost) {
    // TiDB Cloud Serverless requires SSL. Without access to the CA certificate
    // through environment variables, rejectUnauthorized is set to false so the
    // encrypted connection succeeds. For a stricter setup, download the CA from
    // the TiDB Cloud dashboard and add it as an env var (e.g. TIDB_CA_CERT).
    return { rejectUnauthorized: false };
  }
  return undefined;
}

/**
 * Driver configuration is load-bearing:
 *
 * - `timezone: 'Z'` — every DATETIME is stored and read as UTC. Without this the
 *   driver reinterprets values in the server's local zone, which silently moves
 *   every reservation slot when the host's TZ differs from Tunisia's.
 * - `decimalNumbers: false` (the default) — money arrives as a string and is
 *   never turned into a float. See lib/money.ts.
 * - `supportBigNumbers` + `bigNumberStrings` — BIGINT ids stay exact.
 * - `typeCast` — TINYINT(1) becomes a real boolean instead of 0/1.
 */
function buildPool() {
  const ssl = sslOptionsFor(env.DATABASE_URL);
  const opts: PoolOptions = {
    uri: env.DATABASE_URL,
    connectionLimit: env.NODE_ENV === 'production' ? 10 : 5,
    waitForConnections: true,
    queueLimit: 0,
    enableKeepAlive: true,
    timezone: 'Z',
    supportBigNumbers: true,
    bigNumberStrings: true,
    dateStrings: false,
    typeCast(field, next) {
      if (field.type === 'TINY' && field.length === 1) {
        const value = field.string();
        return value === null ? null : value === '1';
      }
      return next();
    },
  };
  if (ssl) {
    opts.ssl = ssl;
  }
  return createPool(opts);
}

function buildDb() {
  return new Kysely<Database>({ dialect: new MysqlDialect({ pool: buildPool() }) });
}

// Next.js dev recreates modules on every edit; without this the pool leaks
// connections until MySQL refuses new ones.
const globalForDb = globalThis as unknown as { __boaDb?: Kysely<Database> };

export const db: Kysely<Database> = globalForDb.__boaDb ?? buildDb();
if (env.NODE_ENV !== 'production') globalForDb.__boaDb = db;

export type DB = typeof db;
export type { Database };
