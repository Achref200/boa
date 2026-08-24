import { config } from 'dotenv';
import mysql from 'mysql2/promise';

config({ path: '.env.local', quiet: true });

/**
 * Restores a seeded product's tagline after a spec has written to it.
 *
 * `admin.spec.ts` proves that an edit made in the admin reaches the storefront
 * without a rebuild, and the cheapest field to prove it on is the tagline of a
 * product that is already published. That assertion is worth keeping — but the
 * edit is a real write to a real row, so left alone it survives the run and the
 * storefront then shows "Accroche de test 1787564018744" under a genuine BOA
 * product, in the demo the client is shown.
 *
 * The seed deliberately leaves taglines empty (no BOA copy is invented), so the
 * correct restore value is NULL, not some remembered string.
 */
export async function clearProductTagline(slug: string): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) return;

  const connection = await mysql.createConnection(url);
  try {
    await connection.execute(
      `UPDATE product_translations t
         JOIN products p ON p.id = t.product_id
          SET t.tagline = NULL
        WHERE p.slug = ?`,
      [slug],
    );
  } finally {
    await connection.end();
  }
}
