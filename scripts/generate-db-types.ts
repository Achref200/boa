/**
 * Introspects the live database and emits `src/db/types.ts`.
 *
 * The SQL migrations are the single source of truth for the schema; hand-written
 * TypeScript interfaces would drift from them within a week. Run this after
 * every migration:  npm run db:types
 */
import { createConnection } from 'mysql2/promise';
import { writeFileSync } from 'node:fs';
import { config } from 'dotenv';

config({ path: '.env.local', quiet: true });
config({ path: '.env', quiet: true });

type Column = {
  TABLE_NAME: string;
  COLUMN_NAME: string;
  DATA_TYPE: string;
  COLUMN_TYPE: string;
  IS_NULLABLE: 'YES' | 'NO';
  COLUMN_DEFAULT: string | null;
  EXTRA: string;
};

/**
 * JSON columns are typed `unknown` and read through `parseJson` — MySQL 8
 * returns them already parsed while MariaDB (what Hostinger usually ships)
 * stores JSON as LONGTEXT and returns a string. Typing them as the parsed shape
 * would be a lie on one of the two engines.
 */
const JSON_COLUMNS = new Set([
  'shipping_zones.governorates',
  'content_blocks.payload',
  'audit_logs.diff',
  'order_events.data',
  'webhook_events.payload',
  'settings.value',
]);

const pascal = (s: string) =>
  s.split('_').map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('');

/** Enough English to name a row type correctly for this schema. */
const singular = (s: string) =>
  s.replace(/ies$/, 'y').replace(/(ss|ch|sh|x|z)es$/, '$1').replace(/([^s])s$/, '$1');

function tsType(c: Column): string {
  const key = `${c.TABLE_NAME}.${c.COLUMN_NAME}`;
  if (JSON_COLUMNS.has(key)) return 'unknown';
  switch (c.DATA_TYPE) {
    case 'enum': {
      const values = c.COLUMN_TYPE.slice(5, -1).split(',').map((v) => v.trim());
      return values.join(' | ');
    }
    case 'tinyint':
      // TINYINT(1) is booleanised by the driver's typeCast (see src/db/client.ts).
      return c.COLUMN_TYPE.startsWith('tinyint(1)') ? 'boolean' : 'number';
    case 'int': case 'smallint': case 'mediumint': case 'float': case 'double':
      return 'number';
    case 'bigint':
      return 'string'; // supportBigNumbers + bigNumberStrings: no silent precision loss
    case 'decimal':
      return 'string'; // money stays a string end to end; see lib/money.ts
    case 'datetime': case 'timestamp': case 'date':
      return 'Date';
    case 'json':
      return 'unknown';
    default:
      return 'string';
  }
}

const isGenerated = (c: Column) =>
  c.EXTRA.includes('auto_increment') || c.COLUMN_DEFAULT !== null;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  const conn = await createConnection(url);
  const dbName = new URL(url).pathname.replace(/^\//, '');

  const [rows] = await conn.query<Column[] & any>(
    `SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA
       FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ?
      ORDER BY TABLE_NAME, ORDINAL_POSITION`,
    [dbName],
  );
  await conn.end();

  const tables = new Map<string, Column[]>();
  for (const row of rows as Column[]) {
    if (row.TABLE_NAME === 'schema_migrations') continue;
    const list = tables.get(row.TABLE_NAME) ?? [];
    list.push(row);
    tables.set(row.TABLE_NAME, list);
  }

  const out: string[] = [
    '/* eslint-disable */',
    '// GENERATED FILE — do not edit by hand.',
    '// Produced from the live schema by `npm run db:types`.',
    '// The SQL under db/migrations is the source of truth.',
    '',
    "import type { ColumnType, Generated, Insertable, Selectable, Updateable } from 'kysely';",
    '',
    'export type Timestamp = ColumnType<Date, Date | string, Date | string>;',
    '',
  ];

  for (const [table, cols] of [...tables].sort()) {
    const name = `${pascal(table)}Table`;
    out.push(`export interface ${name} {`);
    for (const c of cols) {
      let t = tsType(c);
      const nullable = c.IS_NULLABLE === 'YES';
      const generated = isGenerated(c);
      if (t === 'Date') {
        // Nesting ColumnType inside Generated<> stops Kysely unwrapping the
        // select type, so date columns get their ColumnType spelled out.
        const nul = nullable ? ' | null' : '';
        const undef = generated ? ' | undefined' : '';
        t = `ColumnType<Date${nul}, Date | string${nul}${undef}, Date | string${nul}>`;
      } else {
        if (nullable) t = `${t} | null`;
        if (generated) t = `Generated<${t}>`;
      }
      const prop = /^[A-Za-z_$][\w$]*$/.test(c.COLUMN_NAME) ? c.COLUMN_NAME : `'${c.COLUMN_NAME}'`;
      out.push(`  ${prop}: ${t};`);
    }
    out.push('}');
    const row = pascal(singular(table));
    out.push(`export type ${row} = Selectable<${name}>;`);
    out.push(`export type New${row} = Insertable<${name}>;`);
    out.push(`export type ${row}Update = Updateable<${name}>;`);
    out.push('');
  }

  out.push('export interface Database {');
  for (const [table] of [...tables].sort()) {
    out.push(`  ${table}: ${pascal(table)}Table;`);
  }
  out.push('  schema_migrations: { name: string; applied_at: Generated<Timestamp> };');
  out.push('}');
  out.push('');

  writeFileSync('src/db/types.ts', out.join('\n'));
  console.warn(`src/db/types.ts written — ${tables.size} tables`);
}

main().catch((e) => { console.error(e); process.exit(1); });
