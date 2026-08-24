/**
 * Drop everything, migrate, seed, and draw the reserve imagery — one command
 * back to a known-good development database.
 *
 * `package.json` has declared `db:reset` since the first commit while this file
 * did not exist, so the documented way to get a clean database failed with a
 * module-not-found error.
 *
 * Three guards, because the whole point of this script is that it destroys data:
 *
 *  1. It refuses to run with NODE_ENV=production.
 *  2. It refuses a DATABASE_URL that does not look like a development database
 *     (host must be local, or the schema name must end in _dev / _test).
 *  3. It prints the schema it is about to drop and requires --yes.
 *
 * Dropping the *tables* rather than the schema keeps the grants that hPanel and
 * a local MySQL both attach to the database object itself.
 *
 *   npm run db:reset -- --yes
 */
import { createConnection, type RowDataPacket } from 'mysql2/promise';
import { spawnSync } from 'node:child_process';
import { config } from 'dotenv';

config({ path: '.env.local', quiet: true });
config({ path: '.env', quiet: true });

const CONFIRMED = process.argv.includes('--yes');

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

function describe(url: string): { host: string; schema: string } {
  const parsed = new URL(url);
  return { host: parsed.hostname, schema: decodeURIComponent(parsed.pathname.replace(/^\//, '')) };
}

function looksLikeDevelopment({ host, schema }: { host: string; schema: string }): boolean {
  return LOCAL_HOSTS.has(host) || /_(dev|test|local)$/.test(schema);
}

function run(script: string, args: string[] = []): void {
  const result = spawnSync('npx', ['tsx', script, ...args], { stdio: 'inherit', shell: true });
  if (result.status !== 0) throw new Error(`${script} failed`);
}

async function dropAllTables(url: string, schema: string): Promise<number> {
  const conn = await createConnection({ uri: url, multipleStatements: true });
  try {
    const [rows] = await conn.query<RowDataPacket[]>(
      'SELECT TABLE_NAME FROM information_schema.tables WHERE table_schema = ?',
      [schema],
    );
    const tables = rows.map((row) => String(row.TABLE_NAME));
    if (tables.length === 0) return 0;

    // Foreign keys make drop order matter; switching the check off is simpler
    // and safer than topologically sorting 55 tables.
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    await conn.query(tables.map((t) => `DROP TABLE IF EXISTS \`${t}\``).join('; '));
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
    return tables.length;
  } finally {
    await conn.end();
  }
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set. Copy .env.example to .env.local first.');

  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to reset a production database.');
  }

  const target = describe(url);
  if (!looksLikeDevelopment(target)) {
    throw new Error(
      `Refusing to reset ${target.schema} on ${target.host}: it does not look like a development ` +
        'database. Point DATABASE_URL at a local schema, or one named *_dev / *_test.',
    );
  }

  if (!CONFIRMED) {
    console.warn(
      `This drops every table in "${target.schema}" on ${target.host}, then migrates and seeds.\n` +
        'Re-run with --yes to confirm:  npm run db:reset -- --yes',
    );
    process.exitCode = 1;
    return;
  }

  console.warn(`\nRéinitialisation de ${target.schema} sur ${target.host}`);

  const dropped = await dropAllTables(url, target.schema);
  console.warn(`  ${dropped} table(s) supprimée(s).\n`);

  run('scripts/migrate.ts');
  run('scripts/seed.ts');
  run('scripts/seed-media.ts');

  console.warn('\nBase réinitialisée.\n');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
