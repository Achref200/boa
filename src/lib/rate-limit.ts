import 'server-only';

/**
 * In-process fixed-window rate limiting.
 *
 * Honest about its scope: this protects a single Node process, which is exactly
 * what BOA runs on Hostinger today. It is not a distributed limiter, and the
 * moment the app runs on more than one instance this needs to move to Redis or
 * a database table — the interface below is deliberately small so that swap is
 * one file. Doing nothing until then would leave sign-in, checkout and booking
 * unprotected, which is worse than a limiter with a documented boundary.
 */
type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
let lastSweep = Date.now();

function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(key);
}

export type RateLimitResult = { allowed: boolean; remaining: number; retryAfterSeconds: number };

export function rateLimit(key: string, limit: number, windowSeconds: number): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  bucket.count += 1;
  if (bucket.count > limit) {
    return { allowed: false, remaining: 0, retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000) };
  }
  return { allowed: true, remaining: limit - bucket.count, retryAfterSeconds: 0 };
}

/** Limits, in one place, so they can be reasoned about together. */
export const LIMITS = {
  signIn: { limit: 8, window: 300 },
  signUp: { limit: 5, window: 900 },
  checkout: { limit: 12, window: 300 },
  reservation: { limit: 10, window: 300 },
  contact: { limit: 5, window: 900 },
  cartWrite: { limit: 120, window: 60 },
  adminSignIn: { limit: 6, window: 600 },
} as const;
