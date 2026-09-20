import 'server-only';

/**
 * Build-phase guard for database reads.
 *
 * `next build` runs `generateStaticParams` and prerenders pages in a sandbox
 * where the production database may be unreachable (wrong credentials,
 * tunneled host offline, IP allowlist). Before this module, any DB failure in
 * that phase killed the whole build with "Failed to collect page data".
 *
 * `withBuildFallback` returns a safe empty value instead of throwing while the
 * build collects page data, so the build succeeds and real pages are rendered
 * on demand at runtime via ISR (`revalidate` is already set on every
 * storefront page).
 *
 * `withRuntimeFallback` is the V0 sibling: while the production database
 * credentials are still being fixed (TiDB user `4NDFu7xGsv4VSb7.root` is
 * rejected with ER_ACCESS_DENIED), the deployed site must show the
 * storefront / brand V0 rather than a 500. Reads fall back to typed empties
 * (the homepage already renders a shorter page from zero blocks — no
 * placeholders, no invented content), writes still throw.
 *
 * Detection: Next.js sets NEXT_PHASE=phase-production-build during `next
 * build`. Vercel also sets VERCEL_ENV=production at runtime, so checking the
 * phase (not the env name) keeps the two behaviours distinct.
 */
export function isBuildPhase(): boolean {
  return process.env.NEXT_PHASE === 'phase-production-build';
}

export async function withBuildFallback<T>(fallback: T, read: () => Promise<T>): Promise<T> {
  try {
    return await read();
  } catch (error) {
    if (isBuildPhase()) return fallback;
    throw error;
  }
}

/**
 * V0 runtime guard: swallow ONLY database-connectivity errors, rethrow
 * everything else (programming bugs must stay loud). Covers mysql2 error
 * codes for auth / network / timeout plus generic connection failures.
 */
const CONNECTIVITY_CODES = new Set([
  'ER_ACCESS_DENIED_ERROR',
  'ER_BAD_DB_ERROR',
  'ER_DBACCESS_DENIED_ERROR',
  'ECONNREFUSED',
  'ENOTFOUND',
  'EHOSTUNREACH',
  'ETIMEDOUT',
  'EAI_AGAIN',
  'PROTOCOL_CONNECTION_LOST',
  'PROTOCOL_SEQUENCE_TIMEOUT',
  'ER_UNKNOWN_ERROR',
]);

export function isConnectivityError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const code = (error as { code?: unknown }).code;
  if (typeof code === 'string' && CONNECTIVITY_CODES.has(code)) return true;
  const message = error instanceof Error ? error.message : String(error);
  return /connect|timed out|timeout|access denied|unknown database|handshake|socket hang up/i.test(message);
}

export async function withRuntimeFallback<T>(fallback: T, read: () => Promise<T>): Promise<T> {
  try {
    return await read();
  } catch (error) {
    if (isConnectivityError(error)) return fallback;
    throw error;
  }
}

/** Build OR runtime connectivity failure → fallback. Writes must not use this. */
export async function withDbFallback<T>(fallback: T, read: () => Promise<T>): Promise<T> {
  try {
    return await read();
  } catch (error) {
    if (isBuildPhase() || isConnectivityError(error)) return fallback;
    throw error;
  }
}
