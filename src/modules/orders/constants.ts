/**
 * Values shared between server actions and pages. A `'use server'` module may
 * only export async functions, so constants live here.
 */
export const LAST_ORDER_COOKIE = 'boa_last_order';
export const IDEMPOTENCY_TTL_HOURS = 24;
