import { config } from 'dotenv';
import mysql from 'mysql2/promise';

config({ path: '.env.local', quiet: true });

/**
 * Clears the failed-login counter for the seeded admin account.
 *
 * `admin.spec.ts` deliberately submits wrong passwords to prove that a bad
 * e-mail and a bad password are indistinguishable. That is a real assertion
 * about the sign-in surface, and it necessarily increments `failed_logins` —
 * which is the production lockout doing exactly what it should. Left alone the
 * counter survives the run, so a few consecutive suite executions trip the
 * five-attempt threshold and lock the account for thirty minutes, failing every
 * later admin test with "Compte temporairement bloqué" for reasons that have
 * nothing to do with the code under test.
 *
 * The lockout is not the bug; leaking test state between runs is. Any spec that
 * signs in as the admin resets the counter first.
 */
export async function clearAdminLockout(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) return;

  const connection = await mysql.createConnection(url);
  try {
    await connection.execute(
      'UPDATE admin_users SET failed_logins = 0, locked_until = NULL WHERE email = ?',
      [process.env.SEED_ADMIN_EMAIL ?? 'admin@boacosmetic.tn'],
    );
  } finally {
    await connection.end();
  }
}
