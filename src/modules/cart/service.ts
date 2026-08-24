import 'server-only';
import { cookies } from 'next/headers';
import { db } from '@/db/client';
import { newId, newToken } from '@/lib/ids';
import { priceLines, type PricedCart, MAX_QUANTITY_PER_LINE } from '@/modules/orders/pricing';
import { dbLocale, type AppLocale } from '@/i18n/config';
import { AppError } from '@/lib/errors';
import { baseCookieOptions } from '@/lib/cookies';

export const CART_COOKIE = 'boa_cart';
const CART_TTL_DAYS = 30;

const expiry = () => new Date(Date.now() + CART_TTL_DAYS * 24 * 60 * 60 * 1000);

/**
 * The cart lives in the database and the browser only carries an opaque token.
 * That means prices cannot be tampered with, a cart survives a device change
 * once the customer signs in, and admins can see abandoned carts.
 *
 * Server Components cannot set cookies, so reads never create a cart: an
 * unknown token simply reads as empty, and the first `addItem` — a Server
 * Action — creates the row and the cookie together.
 */
async function readCartToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(CART_COOKIE)?.value ?? null;
}

async function findCartIdByToken(token: string | null): Promise<string | null> {
  if (!token) return null;
  const row = await db
    .selectFrom('carts')
    .select(['id'])
    .where('token', '=', token)
    .where('converted_at', 'is', null)
    .where('expires_at', '>', new Date())
    .executeTakeFirst();
  return row?.id ?? null;
}

async function ensureCart(): Promise<{ id: string; token: string }> {
  const token = await readCartToken();
  const existing = await findCartIdByToken(token);
  if (existing && token) {
    await db.updateTable('carts').set({ expires_at: expiry() }).where('id', '=', existing).execute();
    return { id: existing, token };
  }

  const store = await cookies();
  const freshToken = newToken(24);
  const id = newId();
  await db
    .insertInto('carts')
    .values({ id, token: freshToken, currency: 'TND', expires_at: expiry() })
    .execute();

  store.set(CART_COOKIE, freshToken, baseCookieOptions(CART_TTL_DAYS * 24 * 60 * 60));

  return { id, token: freshToken };
}

async function loadRequestedLines(cartId: string) {
  return db
    .selectFrom('cart_items')
    .select(['variant_id as variantId', 'quantity'])
    .where('cart_id', '=', cartId)
    .orderBy('added_at')
    .execute();
}

export type CartView = PricedCart & { cartId: string | null };

const EMPTY: CartView = { cartId: null, lines: [], issues: [], itemCount: 0, subtotal: '0.000' };

/**
 * Re-prices the cart on every read. This is what makes "the price changed while
 * you were shopping" a visible, handled event instead of a silent wrong total.
 */
export async function getCart(locale: AppLocale = 'fr'): Promise<CartView> {
  const cartId = await findCartIdByToken(await readCartToken());
  if (!cartId) return EMPTY;
  const requested = await loadRequestedLines(cartId);
  const priced = await priceLines(requested, dbLocale(locale));
  return { ...priced, cartId };
}

/** Cheap read for the header badge: no pricing, no joins beyond the count. */
export async function getCartSummary(): Promise<{ itemCount: number }> {
  const cartId = await findCartIdByToken(await readCartToken());
  if (!cartId) return { itemCount: 0 };
  const row = await db
    .selectFrom('cart_items')
    .select((eb) => eb.fn.sum<number>('quantity').as('total'))
    .where('cart_id', '=', cartId)
    .executeTakeFirst();
  return { itemCount: Number(row?.total ?? 0) };
}

export async function addItem(variantId: string, quantity = 1): Promise<CartView> {
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new AppError('validation_failed', 'Quantity must be a positive integer');
  }

  // Existence and purchasability are checked here so a forged variant id never
  // reaches the cart table, where it would fail later as a foreign-key error.
  const variant = await db
    .selectFrom('product_variants as v')
    .innerJoin('products as p', 'p.id', 'v.product_id')
    .select(['v.id'])
    .where('v.id', '=', variantId)
    .where('v.is_active', '=', true)
    .where('p.state', '=', 'PUBLISHED')
    .where('p.deleted_at', 'is', null)
    .executeTakeFirst();
  if (!variant) throw new AppError('not_found', 'Product variant is not available');

  const { id: cartId } = await ensureCart();

  const existing = await db
    .selectFrom('cart_items')
    .select(['id', 'quantity'])
    .where('cart_id', '=', cartId)
    .where('variant_id', '=', variantId)
    .executeTakeFirst();

  const next = Math.min(MAX_QUANTITY_PER_LINE, (existing?.quantity ?? 0) + quantity);

  if (existing) {
    await db.updateTable('cart_items').set({ quantity: next }).where('id', '=', existing.id).execute();
  } else {
    await db
      .insertInto('cart_items')
      .values({ id: newId(), cart_id: cartId, variant_id: variantId, quantity: next })
      .execute();
  }

  await db.updateTable('carts').set({ expires_at: expiry() }).where('id', '=', cartId).execute();
  const requested = await loadRequestedLines(cartId);
  return { ...(await priceLines(requested)), cartId };
}

export async function setQuantity(variantId: string, quantity: number): Promise<CartView> {
  if (!Number.isInteger(quantity) || quantity < 0) {
    throw new AppError('validation_failed', 'Quantity must be zero or a positive integer');
  }
  const cartId = await findCartIdByToken(await readCartToken());
  if (!cartId) return EMPTY;

  if (quantity === 0) {
    await db
      .deleteFrom('cart_items')
      .where('cart_id', '=', cartId)
      .where('variant_id', '=', variantId)
      .execute();
  } else {
    await db
      .updateTable('cart_items')
      .set({ quantity: Math.min(MAX_QUANTITY_PER_LINE, quantity) })
      .where('cart_id', '=', cartId)
      .where('variant_id', '=', variantId)
      .execute();
  }

  const requested = await loadRequestedLines(cartId);
  return { ...(await priceLines(requested)), cartId };
}

export const removeItem = (variantId: string) => setQuantity(variantId, 0);

export async function clearCart(): Promise<void> {
  const cartId = await findCartIdByToken(await readCartToken());
  if (!cartId) return;
  await db.deleteFrom('cart_items').where('cart_id', '=', cartId).execute();
}

/** Called after a successful order so the cart is never reused. */
export async function markCartConverted(cartId: string): Promise<void> {
  await db.updateTable('carts').set({ converted_at: new Date() }).where('id', '=', cartId).execute();
  const store = await cookies();
  store.delete(CART_COOKIE);
}

/** Attaches an anonymous cart to a customer when they sign in mid-session. */
export async function attachCartToCustomer(customerId: string): Promise<void> {
  const cartId = await findCartIdByToken(await readCartToken());
  if (!cartId) return;
  await db.updateTable('carts').set({ customer_id: customerId }).where('id', '=', cartId).execute();
}
