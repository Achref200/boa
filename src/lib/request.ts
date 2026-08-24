import 'server-only';
import { headers } from 'next/headers';

/**
 * Client IP behind a reverse proxy. Hostinger fronts the Node app, so
 * `x-forwarded-for` is what actually identifies a caller; the value is
 * attacker-controllable when no proxy is present, which is why it is only ever
 * used for rate-limit bucketing and audit context, never for authorization.
 */
export async function clientIp(): Promise<string> {
  const store = await headers();
  const forwarded = store.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first.slice(0, 60);
  }
  return store.get('x-real-ip')?.slice(0, 60) ?? 'unknown';
}

export async function userAgent(): Promise<string | null> {
  const store = await headers();
  return store.get('user-agent')?.slice(0, 250) ?? null;
}
