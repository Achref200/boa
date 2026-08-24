/**
 * Minimal forward-only migration runner.
 *
 * Deliberately not an ORM feature: on Hostinger the deploy step is "upload,
 * npm ci, npm run build, restart", and a migration runner that is 60 lines of
 * plain SQL execution is one less binary to ship and one less thing to break.
 * Each file in db/migrations runs once, in filename order, inside its own
 * connection with multipleStatements enabled, and is recorded in
 * schema_migrations.
 */
import { createConnection } from 'mysql2/promise';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { config } from 'dotenv';

config({ path: '.env.local', quiet: true });
config({ path: '.env', quiet: true });

const DIR = join(process.cwd(), 'db', 'migrations');

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');

  const conn = await createConnection({ uri: url, multipleStatements: true });
  await conn.query(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       name VARCHAR(190) NOT NULL,
       applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
       PRIMARY KEY (name)
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  );

  const [applied] = await conn.query<{ name: string }[] & any>('SELECT name FROM schema_migrations');
  const done = new Set((applied as { name: string }[]).map((r) => r.name));
  const files = readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort();

  let ran = 0;
  for (const file of files) {
    if (done.has(file)) continue;
    process.stdout.write(`  applying ${file} … `);
    const sql = readFileSync(join(DIR, file), 'utf8');
    try {
      await conn.query(sql);
      await conn.query('INSERT INTO schema_migrations (name) VALUES (?)', [file]);
      ran += 1;
      process.stdout.write('ok\n');
    } catch (error) {
      process.stdout.write('failed\n');
      await conn.end();
      throw error;
    }
  }

  await conn.end();
  console.warn(ran === 0 ? 'Database already up to date.' : `Applied ${ran} migration(s).`);
}

main().catch((e) => { console.error(e); process.exit(1); });
