'use server';

import { z } from 'zod';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { db } from '@/db/client';
import { newId } from '@/lib/ids';
import { hashPassword, needsRehash, verifyPassword, validatePasswordStrength, PASSWORD_MIN_LENGTH } from '@/lib/password';
import { createAdminSession, createCustomerSession, destroyAdminSession, destroyCustomerSession } from './session';
import { attachCartToCustomer } from '@/modules/cart/service';
import { fail, ok, type ActionResult } from '@/lib/errors';
import { rateLimit, LIMITS } from '@/lib/rate-limit';
import { clientIp } from '@/lib/request';
import { isLocale, dbLocale, type AppLocale } from '@/i18n/config';
import { routes, adminRoutes } from '@/lib/routes';

const LOCK_AFTER_ATTEMPTS = 8;
const LOCK_MINUTES = 15;

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(190),
  password: z.string().min(1).max(200),
  locale: z.string().refine(isLocale).optional(),
});

const signUpSchema = credentialsSchema.extend({
  password: z.string().min(PASSWORD_MIN_LENGTH).max(200),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  phone: z.string().trim().max(40).optional().or(z.literal('')),
});

/**
 * Sign-in failures are deliberately indistinguishable.
 *
 * "No such account" and "wrong password" return the same message and take a
 * comparable amount of time, because the difference between them is an account
 * enumeration oracle. Repeated failures lock the account for fifteen minutes,
 * and the IP is rate-limited independently so one attacker cannot lock out
 * every customer in turn.
 */
export async function signInAction(input: unknown): Promise<ActionResult<null>> {
  const ip = await clientIp();
  if (!rateLimit(`signin:${ip}`, LIMITS.signIn.limit, LIMITS.signIn.window).allowed) {
    return fail('rate_limited', 'Too many attempts');
  }

  const parsed = credentialsSchema.safeParse(input);
  if (!parsed.success) return fail('invalid_credentials', 'Invalid credentials');

  const { email, password } = parsed.data;
  const customer = await db
    .selectFrom('customers')
    .select(['id', 'password_hash as passwordHash', 'failed_logins as failedLogins', 'locked_until as lockedUntil'])
    .where('email', '=', email)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (customer?.lockedUntil && customer.lockedUntil > new Date()) {
    return fail('account_locked', 'Account temporarily locked');
  }

  // Always run a hash comparison, even when the account does not exist, so the
  // response time does not reveal which emails are registered.
  const hash = customer?.passwordHash ?? '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv';
  const valid = await verifyPassword(password, hash);

  if (!customer || !customer.passwordHash || !valid) {
    if (customer) {
      const attempts = customer.failedLogins + 1;
      await db
        .updateTable('customers')
        .set({
          failed_logins: attempts,
          locked_until:
            attempts >= LOCK_AFTER_ATTEMPTS ? new Date(Date.now() + LOCK_MINUTES * 60000) : null,
        })
        .where('id', '=', customer.id)
        .execute();
    }
    return fail('invalid_credentials', 'Invalid credentials');
  }

  // Opportunistic upgrade: raising the bcrypt cost later rehashes on next login.
  if (needsRehash(customer.passwordHash)) {
    await db
      .updateTable('customers')
      .set({ password_hash: await hashPassword(password) })
      .where('id', '=', customer.id)
      .execute();
  }

  await db
    .updateTable('customers')
    .set({ failed_logins: 0, locked_until: null })
    .where('id', '=', customer.id)
    .execute();

  await createCustomerSession(customer.id);
  await attachCartToCustomer(customer.id);
  revalidatePath('/', 'layout');
  return ok(null);
}

export async function signUpAction(input: unknown): Promise<ActionResult<null>> {
  const ip = await clientIp();
  if (!rateLimit(`signup:${ip}`, LIMITS.signUp.limit, LIMITS.signUp.window).allowed) {
    return fail('rate_limited', 'Too many attempts');
  }

  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      (fieldErrors[issue.path.join('.') || 'form'] ??= []).push(issue.message);
    }
    return fail('validation_failed', 'Invalid registration data', fieldErrors);
  }

  const data = parsed.data;
  const weakness = validatePasswordStrength(data.password);
  if (weakness) return fail('validation_failed', weakness, { password: [weakness] });

  const existing = await db
    .selectFrom('customers')
    .select(['id', 'password_hash as passwordHash'])
    .where('email', '=', data.email)
    .executeTakeFirst();

  // A guest checkout may already have created a passwordless record for this
  // address. Claiming it is the right behaviour — refusing would strand the
  // customer's order history behind an email they cannot register.
  if (existing?.passwordHash) {
    return fail('conflict', 'account_exists', { email: ['account_exists'] });
  }

  const passwordHash = await hashPassword(data.password);
  const locale = data.locale && isLocale(data.locale) ? dbLocale(data.locale) : 'FR';

  if (existing) {
    await db
      .updateTable('customers')
      .set({
        password_hash: passwordHash,
        first_name: data.firstName,
        last_name: data.lastName,
        phone: data.phone || null,
        locale,
      })
      .where('id', '=', existing.id)
      .execute();
    await createCustomerSession(existing.id);
    await attachCartToCustomer(existing.id);
  } else {
    const id = newId();
    await db
      .insertInto('customers')
      .values({
        id,
        email: data.email,
        password_hash: passwordHash,
        first_name: data.firstName,
        last_name: data.lastName,
        phone: data.phone || null,
        locale,
      })
      .execute();
    await createCustomerSession(id);
    await attachCartToCustomer(id);
  }

  revalidatePath('/', 'layout');
  return ok(null);
}

export async function signOutAction(locale: string): Promise<never> {
  await destroyCustomerSession();
  revalidatePath('/', 'layout');
  redirect(routes.home(isLocale(locale) ? (locale as AppLocale) : 'fr'));
}

/**
 * Administrator sign-in. Separate action, separate cookie, stricter rate limit,
 * and no "account exists" signal of any kind — the admin surface is not a place
 * to be helpful about which addresses are valid.
 */
export async function adminSignInAction(input: unknown): Promise<ActionResult<null>> {
  const ip = await clientIp();
  if (!rateLimit(`adminsignin:${ip}`, LIMITS.adminSignIn.limit, LIMITS.adminSignIn.window).allowed) {
    return fail('rate_limited', 'Too many attempts');
  }

  const parsed = credentialsSchema.safeParse(input);
  if (!parsed.success) return fail('invalid_credentials', 'Invalid credentials');

  const admin = await db
    .selectFrom('admin_users')
    .select(['id', 'password_hash as passwordHash', 'status', 'failed_logins as failedLogins', 'locked_until as lockedUntil'])
    .where('email', '=', parsed.data.email)
    .executeTakeFirst();

  if (admin?.lockedUntil && admin.lockedUntil > new Date()) {
    return fail('account_locked', 'Account temporarily locked');
  }

  const hash = admin?.passwordHash ?? '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv';
  const valid = await verifyPassword(parsed.data.password, hash);

  if (!admin || !valid || admin.status !== 'ACTIVE') {
    if (admin) {
      const attempts = admin.failedLogins + 1;
      await db
        .updateTable('admin_users')
        .set({
          failed_logins: attempts,
          locked_until: attempts >= 5 ? new Date(Date.now() + 30 * 60000) : null,
        })
        .where('id', '=', admin.id)
        .execute();
    }
    return fail('invalid_credentials', 'Invalid credentials');
  }

  await db
    .updateTable('admin_users')
    .set({ failed_logins: 0, locked_until: null, last_login_at: new Date() })
    .where('id', '=', admin.id)
    .execute();

  await createAdminSession(admin.id);
  return ok(null);
}

export async function adminSignOutAction(): Promise<never> {
  await destroyAdminSession();
  redirect(adminRoutes.signIn);
}
