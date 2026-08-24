import { config } from 'dotenv';
import mysql from 'mysql2/promise';

config({ path: '.env.local', quiet: true });

/**
 * Removes a product the CRUD journey created.
 *
 * The journey deliberately ends on *archived* rather than deleted, because
 * "archived must not mean deleted" is one of the things it asserts. That leaves
 * a real row behind, and one row per run accumulates in the catalogue an
 * administrator actually browses — and in the database a client is shown.
 *
 * Teardown, not part of the assertion: it runs after the suite has finished
 * proving the row survived. `products` cascades to translations, variants,
 * media, needs and relations, so one delete is enough. Order lines snapshot
 * their product data and are deliberately not foreign-keyed to it, so past
 * orders are unaffected.
 */
export async function deleteProductBySlug(slug: string): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) return;

  const connection = await mysql.createConnection(url);
  try {
    await connection.execute('DELETE FROM products WHERE slug = ?', [slug]);
  } finally {
    await connection.end();
  }
}
