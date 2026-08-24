'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { addItem, getCart, setQuantity } from './service';
import { fail, ok, type ActionResult } from '@/lib/errors';
import { AppError } from '@/lib/errors';
import { rateLimit, LIMITS } from '@/lib/rate-limit';
import { clientIp } from '@/lib/request';
import { MAX_QUANTITY_PER_LINE } from '@/modules/orders/pricing';

/**
 * Server Actions are the only mutation surface for the storefront.
 *
 * Next.js already verifies the request origin for actions, which covers CSRF;
 * on top of that every action re-validates its input with zod and re-prices the
 * cart from the database, so the browser is never trusted for anything beyond
 * "which variant, how many".
 */
const idSchema = z.string().trim().length(24, 'invalid_id');

const addSchema = z.object({
  variantId: idSchema,
  quantity: z.coerce.number().int().min(1).max(MAX_QUANTITY_PER_LINE).default(1),
});

const setSchema = z.object({
  variantId: idSchema,
  quantity: z.coerce.number().int().min(0).max(MAX_QUANTITY_PER_LINE),
});

export type CartActionResult = ActionResult<{ itemCount: number; issues: string[] }>;

async function guard(): Promise<CartActionResult | null> {
  const ip = await clientIp();
  const result = rateLimit(`cart:${ip}`, LIMITS.cartWrite.limit, LIMITS.cartWrite.window);
  return result.allowed ? null : fail('rate_limited', 'Too many cart operations');
}

export async function addToCartAction(input: unknown): Promise<CartActionResult> {
  const blocked = await guard();
  if (blocked) return blocked;

  const parsed = addSchema.safeParse(input);
  if (!parsed.success) return fail('validation_failed', 'Invalid cart request');

  try {
    const cart = await addItem(parsed.data.variantId, parsed.data.quantity);
    revalidatePath('/', 'layout');
    return ok({ itemCount: cart.itemCount, issues: cart.issues.map((issue) => issue.kind) });
  } catch (error) {
    if (error instanceof AppError) return fail(error.code, error.message);
    console.error('[cart.add]', error);
    return fail('unavailable', 'Cart is temporarily unavailable');
  }
}

export async function setCartQuantityAction(input: unknown): Promise<CartActionResult> {
  const blocked = await guard();
  if (blocked) return blocked;

  const parsed = setSchema.safeParse(input);
  if (!parsed.success) return fail('validation_failed', 'Invalid cart request');

  try {
    const cart = await setQuantity(parsed.data.variantId, parsed.data.quantity);
    revalidatePath('/', 'layout');
    return ok({ itemCount: cart.itemCount, issues: cart.issues.map((issue) => issue.kind) });
  } catch (error) {
    if (error instanceof AppError) return fail(error.code, error.message);
    console.error('[cart.setQuantity]', error);
    return fail('unavailable', 'Cart is temporarily unavailable');
  }
}

/** Adds every step of a ritual in one action, so the customer taps once. */
export async function addManyToCartAction(input: unknown): Promise<CartActionResult> {
  const blocked = await guard();
  if (blocked) return blocked;

  const parsed = z
    .object({ variantIds: z.array(idSchema).min(1).max(12) })
    .safeParse(input);
  if (!parsed.success) return fail('validation_failed', 'Invalid cart request');

  try {
    for (const variantId of parsed.data.variantIds) await addItem(variantId, 1);
    const cart = await getCart();
    revalidatePath('/', 'layout');
    return ok({ itemCount: cart.itemCount, issues: cart.issues.map((issue) => issue.kind) });
  } catch (error) {
    if (error instanceof AppError) return fail(error.code, error.message);
    console.error('[cart.addMany]', error);
    return fail('unavailable', 'Cart is temporarily unavailable');
  }
}
