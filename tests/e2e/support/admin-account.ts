import { config } from 'dotenv';
import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';

config({ path: '.env.local', quiet: true });

/**
 * Aligns the seeded administrator with the credentials the suite signs in with.
 *
 * `scripts/seed.ts` falls back to a *random* password when `SEED_ADMIN_PASSWORD`
 * is unset, so a database seeded before that variable was documented holds a
 * hash nobody knows — and every admin journey then fails with "E-mail ou mot de
 * passe incorrect" on an otherwise correct build. That is open item 0b in
 * docs/STATE.md, and it is a fixture problem, not an application bug: a test
 * that needs to sign in owns the account it signs in as.
 *
 * This resets the password of the account named by `SEED_ADMIN_EMAIL` to the
 * value of `SEED_ADMIN_PASSWORD`, and clears any lockout left by a previous run.
 * It is idempotent and it refuses to touch a production database.
 *
 * Side effect worth knowing: after the suite runs, the local admin password is
 * exactly whatever `.env.local` declares.
 */
export async function ensureAdminAccount(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) return;

  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to reset an administrator password on a production database.');
  }

  /**
   * NODE_ENV alone is not a safety net: a staging box rarely sets it to
   * "production", and `.env.example` ships a *published* default password. This
   * helper writes that password into `admin_users`, so it must never run against
   * a database it cannot prove is local. Anything remote needs a deliberate,
   * per-run opt-in.
   */
  const host = (() => {
    try {
      return new URL(url).hostname;
    } catch {
      return '';
    }
  })();
  const isLocal = ['localhost', '127.0.0.1', '::1', ''].includes(host);
  if (!isLocal && process.env.E2E_ALLOW_ADMIN_RESET !== '1') {
    throw new Error(
      `Refusing to reset the administrator password on a non-local database (${host}). ` +
        'This would install the password published in .env.example. ' +
        'Set E2E_ALLOW_ADMIN_RESET=1 only if you genuinely intend that.',
    );
  }

  const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@boacosmetic.tn';
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!password) {
    throw new Error(
      'SEED_ADMIN_PASSWORD is not set. The admin E2E journeys cannot sign in without it — ' +
        'set it in .env.local (see .env.example) and re-run.',
    );
  }

  const connection = await mysql.createConnection(url);
  try {
    const [rows] = await connection.execute<mysql.RowDataPacket[]>(
      'SELECT id, password_hash FROM admin_users WHERE email = ?',
      [email],
    );
    const admin = rows[0];
    if (!admin) {
      throw new Error(
        `No administrator with e-mail ${email}. Run "npm run db:seed" with SEED_ADMIN_EMAIL set.`,
      );
    }

    // Only rewrite the hash when it does not already match, so a correctly
    // seeded database is left exactly as it is.
    const alreadyCorrect = await bcrypt.compare(password, String(admin.password_hash));
    if (!alreadyCorrect) {
      const hash = await bcrypt.hash(password, 12);
      await connection.execute('UPDATE admin_users SET password_hash = ? WHERE id = ?', [
        hash,
        admin.id,
      ]);
    }

    await connection.execute(
      'UPDATE admin_users SET failed_logins = 0, locked_until = NULL WHERE id = ?',
      [admin.id],
    );
  } finally {
    await connection.end();
  }
}
