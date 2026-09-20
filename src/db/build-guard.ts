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
 * storefront page). At runtime (server serving requests) it rethrows — a
 * broken database must be loud, not a silent empty shop.
 *
 * Detection: Next.js sets NEXT_PHASE=phase-production-build during `next
 * build`. Vercel also sets VERCEL_ENV=production at runtime, so checking the
 * phase (not the env name) keeps runtime errors loud on Vercel.
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
