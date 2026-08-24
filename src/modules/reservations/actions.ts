'use server';

import { z } from 'zod';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { createReservation, cancelReservation } from './booking';
import { fail, ok, AppError, type ActionResult } from '@/lib/errors';
import { rateLimit, LIMITS } from '@/lib/rate-limit';
import { clientIp } from '@/lib/request';
import { dbLocale, isLocale, type AppLocale } from '@/i18n/config';
import { getCurrentCustomer } from '@/modules/identity/session';
import { baseCookieOptions } from '@/lib/cookies';
import { LAST_RESERVATION_COOKIE } from './constants';

const phoneSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/[\s.-]/g, ''))
  .refine((value) => /^(\+216)?[2-59]\d{7}$/.test(value), { message: 'invalid_phone' });

const bookingSchema = z.object({
  locale: z.string().refine(isLocale),
  idempotencyKey: z.string().trim().min(16).max(80),
  serviceId: z.string().trim().length(24),
  slotId: z.string().trim().length(24),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.string().trim().toLowerCase().email().max(190),
  phone: phoneSchema,
  note: z.string().trim().max(1000).optional().or(z.literal('')),
});

export type BookingResult = ActionResult<{ reference: string }>;

export async function createReservationAction(input: unknown): Promise<BookingResult> {
  const ip = await clientIp();
  const limit = rateLimit(`booking:${ip}`, LIMITS.reservation.limit, LIMITS.reservation.window);
  if (!limit.allowed) return fail('rate_limited', 'Too many attempts');

  const parsed = bookingSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      (fieldErrors[issue.path.join('.') || 'form'] ??= []).push(issue.message);
    }
    return fail('validation_failed', 'Invalid booking data', fieldErrors);
  }

  const data = parsed.data;
  const locale = data.locale as AppLocale;
  const customer = await getCurrentCustomer();

  try {
    const result = await createReservation({
      idempotencyKey: data.idempotencyKey,
      serviceId: data.serviceId,
      slotId: data.slotId,
      customerId: customer?.id ?? null,
      locale: dbLocale(locale),
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: data.phone,
      note: data.note || null,
    });

    (await cookies()).set(
      LAST_RESERVATION_COOKIE,
      result.reference,
      baseCookieOptions(60 * 60 * 2),
    );
    revalidatePath('/', 'layout');

    return ok({ reference: result.reference });
  } catch (error) {
    if (error instanceof AppError) return fail(error.code, error.message);
    console.error('[reservation.create]', error);
    return fail('unavailable', 'Booking is temporarily unavailable');
  }
}

export async function cancelReservationAction(input: unknown): Promise<ActionResult<null>> {
  const parsed = z
    .object({ reservationId: z.string().trim().length(24), reason: z.string().trim().max(255).optional() })
    .safeParse(input);
  if (!parsed.success) return fail('validation_failed', 'Invalid request');

  const customer = await getCurrentCustomer();
  if (!customer) return fail('unauthenticated', 'Sign in required');

  try {
    await cancelReservation(parsed.data.reservationId, parsed.data.reason ?? null, 'customer');
    revalidatePath('/', 'layout');
    return ok(null);
  } catch (error) {
    if (error instanceof AppError) return fail(error.code, error.message);
    console.error('[reservation.cancel]', error);
    return fail('unavailable', 'Cancellation failed');
  }
}
