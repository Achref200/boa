'use server';

import { z } from 'zod';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { createOrder } from './service';
import { getCart, CART_COOKIE } from '@/modules/cart/service';
import { fail, ok, type ActionResult, AppError } from '@/lib/errors';
import { rateLimit, LIMITS } from '@/lib/rate-limit';
import { clientIp } from '@/lib/request';
import { dbLocale, isLocale, type AppLocale } from '@/i18n/config';
import { routes } from '@/lib/routes';
import { getCurrentCustomer } from '@/modules/identity/session';
import { LAST_ORDER_COOKIE } from './constants';
import { baseCookieOptions } from '@/lib/cookies';

/**
 * Tunisian mobile and landline numbers are eight digits, optionally prefixed
 * with +216. Anything else is rejected here rather than discovered by the
 * courier.
 */
const phoneSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/[\s.-]/g, ''))
  .refine((value) => /^(\+216)?[2-59]\d{7}$/.test(value), { message: 'invalid_phone' });

const checkoutSchema = z
  .object({
    locale: z.string().refine(isLocale),
    idempotencyKey: z.string().trim().min(16).max(80),
    fulfilment: z.enum(['DELIVERY', 'HAND_TO_HAND', 'STORE_PICKUP']),
    paymentProviderKey: z.string().trim().min(2).max(40),
    email: z.string().trim().toLowerCase().email().max(190),
    phone: phoneSchema,
    firstName: z.string().trim().min(1).max(80),
    lastName: z.string().trim().min(1).max(80),
    addressLine1: z.string().trim().max(190).optional().or(z.literal('')),
    addressLine2: z.string().trim().max(190).optional().or(z.literal('')),
    city: z.string().trim().max(90).optional().or(z.literal('')),
    governorate: z.string().trim().max(90).optional().or(z.literal('')),
    postalCode: z.string().trim().max(20).optional().or(z.literal('')),
    pickupPointId: z.string().trim().length(24).optional().or(z.literal('')),
    note: z.string().trim().max(1000).optional().or(z.literal('')),
    discountCode: z.string().trim().max(40).optional().or(z.literal('')),
    acceptTerms: z.literal(true, { message: 'terms_required' }),
  })
  .superRefine((value, ctx) => {
    if (value.fulfilment === 'STORE_PICKUP') {
      if (!value.pickupPointId) {
        ctx.addIssue({ code: 'custom', path: ['pickupPointId'], message: 'required' });
      }
      return;
    }
    for (const field of ['addressLine1', 'city', 'governorate'] as const) {
      if (!value[field]) ctx.addIssue({ code: 'custom', path: [field], message: 'required' });
    }
  });

export type CheckoutResult = ActionResult<{ reference: string; redirectUrl: string | null }>;

export async function placeOrderAction(input: unknown): Promise<CheckoutResult> {
  const ip = await clientIp();
  const limit = rateLimit(`checkout:${ip}`, LIMITS.checkout.limit, LIMITS.checkout.window);
  if (!limit.allowed) return fail('rate_limited', 'Too many attempts');

  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join('.') || 'form';
      (fieldErrors[key] ??= []).push(issue.message);
    }
    return fail('validation_failed', 'Invalid checkout data', fieldErrors);
  }

  const data = parsed.data;
  const locale = data.locale as AppLocale;

  const cart = await getCart(locale);
  if (!cart.cartId || cart.lines.length === 0) return fail('cart_empty', 'Cart is empty');

  const customer = await getCurrentCustomer();

  try {
    const result = await createOrder({
      idempotencyKey: data.idempotencyKey,
      cartId: cart.cartId,
      lines: cart.lines.map((line) => ({ variantId: line.variantId, quantity: line.quantity })),
      fulfilment: data.fulfilment,
      paymentProviderKey: data.paymentProviderKey,
      locale: dbLocale(locale),
      discountCode: data.discountCode || null,
      customerId: customer?.id ?? null,
      pickupPointId: data.pickupPointId || null,
      contact: {
        email: data.email,
        phone: data.phone,
        firstName: data.firstName,
        lastName: data.lastName,
        addressLine1: data.addressLine1 || null,
        addressLine2: data.addressLine2 || null,
        city: data.city || null,
        governorate: data.governorate || null,
        postalCode: data.postalCode || null,
        note: data.note || null,
      },
    });

    const store = await cookies();
    // The cart row is marked converted inside the transaction; the cookie is
    // cleared here so a back-button does not resurrect a spent cart.
    store.delete(CART_COOKIE);
    // A short-lived, httpOnly receipt cookie lets the confirmation page show the
    // order once without putting anything guessable in the URL. After it expires
    // the same order is reachable through /suivi with reference + email.
    store.set(LAST_ORDER_COOKIE, result.reference, baseCookieOptions(60 * 60 * 2));
    revalidatePath('/', 'layout');

    return ok({ reference: result.reference, redirectUrl: result.redirectUrl });
  } catch (error) {
    if (error instanceof AppError) {
      if (error.code === 'out_of_stock') {
        const name = typeof error.details?.name === 'string' ? error.details.name : '';
        return fail('out_of_stock', name);
      }
      return fail(error.code, error.message);
    }
    console.error('[checkout]', error);
    return fail('unavailable', 'Checkout is temporarily unavailable');
  }
}

/** Used by the confirmation page's "continue" link so the locale is preserved. */
export async function goToOrder(locale: AppLocale, reference: string): Promise<never> {
  redirect(routes.orderConfirmation(locale, reference));
}
