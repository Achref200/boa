import { Kysely, MysqlDialect } from 'kysely';
import { createPool, type PoolOptions } from 'mysql2';
import type { Database } from './types';
import { mysqlConnectionOptions } from './dsn';
import { env } from '@/lib/env';

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
 *
 * The host/credentials come from `dsn.ts`, which parses them without a URL
 * round-trip so a password containing `@ # ? /` arrives intact. That is the
 * difference between `ER_ACCESS_DENIED` and a working deploy.
 */
function buildPool() {
  const opts: PoolOptions = {
    ...mysqlConnectionOptions(),
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
