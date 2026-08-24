/**
 * Removes what the end-to-end suite leaves behind in a development database.
 *
 * The E2E journeys are written against the real application, so they create
 * real rows and make real edits. Three kinds of residue survive a run:
 *
 *  1. **Products the CRUD journey created** (`e2e-produit-<timestamp>`). The
 *     journey ends on *archived* rather than deleted, because "archived must not
 *     mean deleted" is one of the things it proves — so the row is meant to
 *     survive the test, just not the week.
 *  2. **Accounts the sign-up journey created** (`…@example.test`).
 *  3. **Edits to real seeded rows.** `admin.spec.ts` proves an admin edit reaches
 *     the storefront without a rebuild by writing a tagline onto a published
 *     product — which then reads "Accroche de test 1787564018744" on the public
 *     site. The seed deliberately leaves taglines empty (no BOA copy is
 *     invented), so the correct restore value is NULL.
 *
 * The specs now clean up after themselves; this script exists for databases that
 * predate that, and as the one command to run before showing the site to anyone.
 *
 * It only ever touches rows it can identify as test data by pattern. It never
 * truncates, and it refuses to run against production.
 *
 *   npm run db:clean            report what would be removed
 *   npm run db:clean -- --yes   remove it
 */
import { createConnection, type ResultSetHeader, type RowDataPacket } from 'mysql2/promise';
import { config } from 'dotenv';

config({ path: '.env.local', quiet: true });
config({ path: '.env', quiet: true });

const CONFIRMED = process.argv.includes('--yes');

/** Products the CRUD journey creates. */
const TEST_PRODUCT_SLUG = 'e2e-produit-%';
/** RFC 2606 reserves .test; the sign-up journey uses it precisely so this is safe. */
const TEST_EMAIL = '%@example.test';
/** The one published product `admin.spec.ts` writes a tagline onto. */
const EDITED_PRODUCT = 'boa-masque-cheveux';

type Finding = { what: string; count: number; apply: (c: Connection) => Promise<number> };
type Connection = Awaited<ReturnType<typeof createConnection>>;

async function count(conn: Connection, sql: string, params: unknown[] = []): Promise<number> {
  const [rows] = await conn.query<RowDataPacket[]>(sql, params);
  return Number(rows[0]?.n ?? 0);
}

async function affected(conn: Connection, sql: string, params: unknown[] = []): Promise<number> {
  const [result] = await conn.query<ResultSetHeader>(sql, params);
  return result.affectedRows;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set. Copy .env.example to .env.local first.');
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to clean test data out of a production database.');
  }

  const conn = await createConnection({ uri: url });

  try {
    const findings: Finding[] = [
      {
        what: 'produit(s) créé(s) par les tests',
        count: await count(conn, 'SELECT COUNT(*) n FROM products WHERE slug LIKE ?', [TEST_PRODUCT_SLUG]),
        // products cascades to translations, variants, media, needs and
        // relations. Order lines snapshot their product data and are
        // deliberately not foreign-keyed, so past orders are untouched.
        apply: (c) => affected(c, 'DELETE FROM products WHERE slug LIKE ?', [TEST_PRODUCT_SLUG]),
      },
      {
        what: 'compte(s) client créé(s) par les tests',
        count: await count(conn, 'SELECT COUNT(*) n FROM customers WHERE email LIKE ?', [TEST_EMAIL]),
        // Sessions and addresses cascade; orders and reservations are detached
        // rather than deleted, which is what the schema already chose.
        apply: (c) => affected(c, 'DELETE FROM customers WHERE email LIKE ?', [TEST_EMAIL]),
      },
      {
        what: 'accroche(s) de test sur un produit réel',
        count: await count(
          conn,
          `SELECT COUNT(*) n
             FROM product_translations t
             JOIN products p ON p.id = t.product_id
            WHERE p.slug = ? AND t.tagline IS NOT NULL`,
          [EDITED_PRODUCT],
        ),
        apply: (c) =>
          affected(
            c,
            `UPDATE product_translations t
               JOIN products p ON p.id = t.product_id
                SET t.tagline = NULL
              WHERE p.slug = ? AND t.tagline IS NOT NULL`,
            [EDITED_PRODUCT],
          ),
      },
    ];

    const total = findings.reduce((sum, f) => sum + f.count, 0);

    if (total === 0) {
      console.warn('\nAucune donnée de test trouvée. La base est propre.\n');
      return;
    }

    console.warn('');
    for (const finding of findings) {
      if (finding.count > 0) console.warn(`  ${String(finding.count).padStart(3)}  ${finding.what}`);
    }

    if (!CONFIRMED) {
      console.warn('\nRelancer avec --yes pour supprimer :  npm run db:clean -- --yes\n');
      process.exitCode = 1;
      return;
    }

    console.warn('');
    for (const finding of findings) {
      if (finding.count === 0) continue;
      const rows = await finding.apply(conn);
      console.warn(`  − ${String(rows).padStart(3)}  ${finding.what}`);
    }
    console.warn('\nBase nettoyée.\n');
  } finally {
    await conn.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
