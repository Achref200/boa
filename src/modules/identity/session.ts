import 'server-only';
import { cookies } from 'next/headers';
import { createHash } from 'node:crypto';
import { cache } from 'react';
import { db } from '@/db/client';
import { newId, newToken } from '@/lib/ids';
import { clientIp, userAgent } from '@/lib/request';
import type { Permission } from '@/lib/permissions';
import { baseCookieOptions } from '@/lib/cookies';

/**
 * Sessions are database rows; the cookie carries an opaque 256-bit token and
 * only the token's SHA-256 is stored. Consequences that matter:
 *   • a database dump does not hand an attacker usable sessions;
 *   • BOA can revoke a session (or every session) server-side, which a signed
 *     JWT cannot do without a blacklist that is itself a session table;
 *   • rotating APP_SECRET does not sign customers out.
 *
 * The cost is one indexed lookup per request, which is nothing next to the
 * queries a page already makes.
 */
const CUSTOMER_COOKIE = 'boa_session';
const ADMIN_COOKIE = 'boa_admin_session';
const CUSTOMER_TTL_DAYS = 60;
const ADMIN_TTL_HOURS = 12;

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

const cookieOptions = baseCookieOptions;

// ── customers ───────────────────────────────────────────────────────────────

export type CurrentCustomer = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
};

export async function createCustomerSession(customerId: string): Promise<void> {
  const token = newToken(32);
  const expiresAt = new Date(Date.now() + CUSTOMER_TTL_DAYS * 24 * 60 * 60 * 1000);

  await db
    .insertInto('customer_sessions')
    .values({ id: newId(), token_hash: hashToken(token), customer_id: customerId, expires_at: expiresAt })
    .execute();

  (await cookies()).set(CUSTOMER_COOKIE, token, cookieOptions(CUSTOMER_TTL_DAYS * 24 * 60 * 60));
}

/**
 * `cache` de-duplicates the lookup across a single render — a layout, a page
 * and three server components asking "who is this?" cost one query, not five.
 */
export const getCurrentCustomer = cache(async (): Promise<CurrentCustomer | null> => {
  const token = (await cookies()).get(CUSTOMER_COOKIE)?.value;
  if (!token) return null;

  const row = await db
    .selectFrom('customer_sessions as s')
    .innerJoin('customers as c', 'c.id', 's.customer_id')
    .select([
      'c.id', 'c.email', 'c.first_name as firstName', 'c.last_name as lastName', 'c.phone',
    ])
    .where('s.token_hash', '=', hashToken(token))
    .where('s.revoked_at', 'is', null)
    .where('s.expires_at', '>', new Date())
    .where('c.deleted_at', 'is', null)
    .executeTakeFirst();

  return row ?? null;
});

export async function destroyCustomerSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(CUSTOMER_COOKIE)?.value;
  if (token) {
    await db
      .updateTable('customer_sessions')
      .set({ revoked_at: new Date() })
      .where('token_hash', '=', hashToken(token))
      .execute();
  }
  store.delete(CUSTOMER_COOKIE);
}

// ── administrators ──────────────────────────────────────────────────────────

export type CurrentAdmin = {
  id: string;
  email: string;
  name: string;
  roleKey: string;
  permissions: ReadonlySet<Permission>;
};

export async function createAdminSession(adminId: string): Promise<void> {
  const token = newToken(32);
  const expiresAt = new Date(Date.now() + ADMIN_TTL_HOURS * 60 * 60 * 1000);

  await db
    .insertInto('admin_sessions')
    .values({
      id: newId(),
      token_hash: hashToken(token),
      admin_id: adminId,
      ip: await clientIp(),
      user_agent: await userAgent(),
      expires_at: expiresAt,
    })
    .execute();

  // Admin sessions are shorter-lived and SameSite=Strict: there is no
  // legitimate cross-site navigation into the operations application.
  (await cookies()).set(ADMIN_COOKIE, token, {
    ...cookieOptions(ADMIN_TTL_HOURS * 60 * 60),
    sameSite: 'strict',
  });
}

export const getCurrentAdmin = cache(async (): Promise<CurrentAdmin | null> => {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!token) return null;

  const row = await db
    .selectFrom('admin_sessions as s')
    .innerJoin('admin_users as a', 'a.id', 's.admin_id')
    .innerJoin('roles as r', 'r.id', 'a.role_id')
    .select(['a.id', 'a.email', 'a.name', 'a.status', 'r.id as roleId', 'r.key as roleKey'])
    .where('s.token_hash', '=', hashToken(token))
    .where('s.revoked_at', 'is', null)
    .where('s.expires_at', '>', new Date())
    .executeTakeFirst();

  if (!row || row.status !== 'ACTIVE') return null;

  const permissions = await db
    .selectFrom('role_permissions as rp')
    .innerJoin('permissions as p', 'p.id', 'rp.permission_id')
    .select('p.key')
    .where('rp.role_id', '=', row.roleId)
    .execute();

  return {
    id: row.id,
    email: row.email,
    name: row.name,
    roleKey: row.roleKey,
    permissions: new Set(permissions.map((p) => p.key as Permission)),
  };
});

export async function destroyAdminSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(ADMIN_COOKIE)?.value;
  if (token) {
    await db
      .updateTable('admin_sessions')
      .set({ revoked_at: new Date() })
      .where('token_hash', '=', hashToken(token))
      .execute();
  }
  store.delete(ADMIN_COOKIE);
}

/** Housekeeping, called opportunistically from the admin dashboard. */
export async function purgeExpiredSessions(): Promise<void> {
  const now = new Date();
  await db.deleteFrom('customer_sessions').where('expires_at', '<', now).execute();
  await db.deleteFrom('admin_sessions').where('expires_at', '<', now).execute();
  await db.deleteFrom('idempotency_keys').where('expires_at', '<', now).execute();
  await db.deleteFrom('carts').where('expires_at', '<', now).execute();
}

export { CUSTOMER_COOKIE, ADMIN_COOKIE };
