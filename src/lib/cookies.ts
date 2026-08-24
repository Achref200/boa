/**
 * Whether cookies are issued with the `Secure` attribute.
 *
 * Derived from the configured public origin rather than from NODE_ENV: a
 * production build served over plain HTTP (a staging box, a container behind an
 * unterminated proxy, the end-to-end suite) would otherwise set Secure cookies
 * that the browser silently discards — and a silently discarded session cookie
 * looks exactly like a broken login.
 *
 * Read directly from process.env so client bundles can share the module
 * without pulling in the server-only env schema.
 */
export const cookiesAreSecure = (
  process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
).startsWith('https://');

export const baseCookieOptions = (maxAgeSeconds: number) => ({
  httpOnly: true as const,
  sameSite: 'lax' as const,
  secure: cookiesAreSecure,
  path: '/',
  maxAge: maxAgeSeconds,
});
