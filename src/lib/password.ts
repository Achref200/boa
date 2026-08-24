import bcrypt from 'bcryptjs';

/**
 * bcrypt, not argon2.
 *
 * Argon2id is the better algorithm, but every maintained Node binding for it is
 * a native addon, and Hostinger's shared containers cannot reliably build one —
 * a deploy that fails on `npm ci` is a worse security outcome than a slightly
 * older KDF. `bcryptjs` is pure JavaScript, so it installs anywhere.
 *
 * Cost 12 is ~250ms on the target hardware: slow enough to matter to an
 * attacker, fast enough that a login does not feel broken. Raise it here, in one
 * place, when the hosting improves — `needsRehash` upgrades existing hashes on
 * the next successful sign-in.
 */
const COST = 12;

export const hashPassword = (plain: string): Promise<string> => bcrypt.hash(plain, COST);

export const verifyPassword = (plain: string, hash: string): Promise<boolean> =>
  bcrypt.compare(plain, hash);

export function needsRehash(hash: string): boolean {
  const rounds = Number.parseInt(hash.split('$')[2] ?? '0', 10);
  return Number.isNaN(rounds) || rounds < COST;
}

/**
 * Password rules that actually help: length beats composition. NIST dropped
 * character-class requirements years ago because they push people towards
 * "Password1!" — a long passphrase is stronger and easier to remember.
 */
export const PASSWORD_MIN_LENGTH = 12;

export function validatePasswordStrength(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) return 'too_short';
  if (password.length > 200) return 'too_long';
  if (/^(.)\1+$/.test(password)) return 'too_simple';
  return null;
}
