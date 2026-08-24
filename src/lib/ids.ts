import { randomBytes, randomUUID } from 'node:crypto';

/**
 * 24-character, URL-safe, lexicographically sortable id.
 *
 * The first 8 characters are a base32 millisecond timestamp, so ids created
 * later sort later — which keeps InnoDB's clustered primary-key inserts
 * sequential instead of scattering pages the way a random UUID does. The
 * remaining 16 characters are random.
 */
const ALPHABET = '0123456789abcdefghjkmnpqrstvwxyz'; // Crockford-ish, no i/l/o/u

function encodeTime(ms: number, length: number): string {
  let out = '';
  let value = ms;
  for (let i = 0; i < length; i += 1) {
    out = ALPHABET[value % 32]! + out;
    value = Math.floor(value / 32);
  }
  return out;
}

export function newId(): string {
  const bytes = randomBytes(16);
  let random = '';
  for (let i = 0; i < 16; i += 1) random += ALPHABET[bytes[i]! % 32];
  return encodeTime(Date.now(), 8) + random;
}

/** Opaque high-entropy token for cart and session cookies. */
export function newToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export { randomUUID };
