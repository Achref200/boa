import 'server-only';
import type { Kysely } from 'kysely';
import type { Database } from '@/db/types';
import { db as defaultDb } from '@/db/client';
import { addMoney, compareMoney, multiplyMoney, percentOfMoney, subtractMoney } from '@/lib/money';
import { parseJson } from '@/lib/json';
import type { MoneyString } from '@/lib/money';

/**
 * The single source of truth for money.
 *
 * Nothing outside this file computes a total. The client sends
 * `{ variantId, quantity }` and never a price; every figure below is re-read
 * from the database at the moment of use, so a tampered request, a stale tab or
 * a price edited five minutes ago all resolve to the price BOA is charging now.
 */

export type RequestedLine = { variantId: string; quantity: number };

export type PricedLine = {
  variantId: string;
  productId: string;
  productSlug: string;
  productName: string;
  sku: string;
  format: string;
  imagePath: string | null;
  unitPrice: MoneyString;
  compareAtPrice: MoneyString | null;
  quantity: number;
  lineTotal: MoneyString;
  stock: number;
  allowBackorder: boolean;
};

/** Something changed between the customer's view and now. Never silent. */
export type PricingIssue =
  | { kind: 'removed'; variantId: string; name: string }
  | { kind: 'quantity_reduced'; variantId: string; name: string; available: number }
  | { kind: 'out_of_stock'; variantId: string; name: string };

export type PricedCart = {
  lines: PricedLine[];
  issues: PricingIssue[];
  itemCount: number;
  subtotal: MoneyString;
};

export type FulfilmentMethod = 'DELIVERY' | 'HAND_TO_HAND' | 'STORE_PICKUP';

export type Quote = PricedCart & {
  discountCode: string | null;
  discountTotal: MoneyString;
  shippingTotal: MoneyString;
  grandTotal: MoneyString;
  shippingAvailable: boolean;
};

export const MAX_QUANTITY_PER_LINE = 20;

type DB = Kysely<Database>;

/**
 * Prices a set of requested lines. Products that were unpublished, archived,
 * soft-deleted or deactivated since the customer added them are dropped with an
 * explicit issue; quantities beyond available stock are reduced rather than
 * rejected, because losing a whole cart to one sold-out item is worse UX than
 * being told what changed.
 */
export async function priceLines(
  requested: RequestedLine[],
  locale: 'FR' | 'EN' | 'AR' = 'FR',
  db: DB = defaultDb,
): Promise<PricedCart> {
  const issues: PricingIssue[] = [];
  const wanted = requested.filter((line) => line.quantity > 0);
  if (wanted.length === 0) return { lines: [], issues, itemCount: 0, subtotal: '0.000' };

  const ids = [...new Set(wanted.map((line) => line.variantId))];

  const rows = await db
    .selectFrom('product_variants as v')
    .innerJoin('products as p', 'p.id', 'v.product_id')
    .leftJoin('product_translations as t', (join) =>
      join.onRef('t.product_id', '=', 'p.id').on('t.locale', '=', locale),
    )
    .leftJoin('product_translations as f', (join) =>
      join.onRef('f.product_id', '=', 'p.id').on('f.locale', '=', 'FR'),
    )
    .where('v.id', 'in', ids)
    .select((eb) => [
      'v.id as variantId',
      'v.sku',
      'v.format',
      'v.price',
      'v.compare_at_price as compareAtPrice',
      'v.stock',
      'v.allow_backorder as allowBackorder',
      'v.is_active as isActive',
      'p.id as productId',
      'p.slug as productSlug',
      'p.state',
      'p.deleted_at as deletedAt',
      eb.fn.coalesce('t.name', 'f.name', 'p.slug').as('productName'),
      eb
        .selectFrom('product_media as m')
        .select('m.path')
        .whereRef('m.product_id', '=', 'p.id')
        .orderBy('m.position')
        .limit(1)
        .as('imagePath'),
    ])
    .execute();

  const byId = new Map(rows.map((row) => [row.variantId, row]));
  const lines: PricedLine[] = [];

  for (const request of wanted) {
    const variant = byId.get(request.variantId);

    if (!variant || !variant.isActive || variant.state !== 'PUBLISHED' || variant.deletedAt) {
      issues.push({
        kind: 'removed',
        variantId: request.variantId,
        name: variant?.productName ?? request.variantId,
      });
      continue;
    }

    const ceiling = Math.min(request.quantity, MAX_QUANTITY_PER_LINE);
    let quantity = ceiling;

    if (!variant.allowBackorder && variant.stock < quantity) {
      if (variant.stock <= 0) {
        issues.push({ kind: 'out_of_stock', variantId: variant.variantId, name: variant.productName });
        continue;
      }
      quantity = variant.stock;
      issues.push({
        kind: 'quantity_reduced',
        variantId: variant.variantId,
        name: variant.productName,
        available: variant.stock,
      });
    }

    lines.push({
      variantId: variant.variantId,
      productId: variant.productId,
      productSlug: variant.productSlug,
      productName: variant.productName,
      sku: variant.sku,
      format: variant.format,
      imagePath: variant.imagePath ?? null,
      unitPrice: variant.price,
      compareAtPrice: variant.compareAtPrice,
      quantity,
      lineTotal: multiplyMoney(variant.price, quantity),
      stock: variant.stock,
      allowBackorder: variant.allowBackorder,
    });
  }

  return {
    lines,
    issues,
    itemCount: lines.reduce((sum, line) => sum + line.quantity, 0),
    subtotal: lines.length > 0 ? addMoney(...lines.map((line) => line.lineTotal)) : '0.000',
  };
}

export type ShippingQuote = { available: boolean; price: MoneyString; etaDays: string | null };

/**
 * Delivery is priced from admin-managed zones. A governorate with no zone has
 * no delivery option — the checkout says so and offers pickup, rather than
 * inventing a fee.
 */
export async function quoteShipping(
  fulfilment: FulfilmentMethod,
  governorate: string | null,
  subtotal: MoneyString,
  db: DB = defaultDb,
): Promise<ShippingQuote> {
  if (fulfilment === 'STORE_PICKUP') return { available: true, price: '0.000', etaDays: null };
  if (!governorate) return { available: false, price: '0.000', etaDays: null };

  const zones = await db
    .selectFrom('shipping_zones')
    .select(['governorates', 'price', 'free_above as freeAbove', 'eta_days as etaDays'])
    .where('is_active', '=', true)
    .orderBy('position')
    .execute();

  const target = governorate.trim().toLowerCase();
  const zone = zones.find((z) =>
    parseJson<string[]>(z.governorates, []).some((g) => g.trim().toLowerCase() === target),
  );
  if (!zone) return { available: false, price: '0.000', etaDays: null };

  const free = zone.freeAbove !== null && compareMoney(subtotal, zone.freeAbove) >= 0;
  return { available: true, price: free ? '0.000' : zone.price, etaDays: zone.etaDays };
}

export type DiscountResult = {
  code: string | null;
  amount: MoneyString;
  freeShipping: boolean;
  error: 'unknown' | 'expired' | 'exhausted' | 'min_subtotal' | null;
};

const NO_DISCOUNT: DiscountResult = { code: null, amount: '0.000', freeShipping: false, error: null };

export async function quoteDiscount(
  code: string | null,
  subtotal: MoneyString,
  db: DB = defaultDb,
): Promise<DiscountResult> {
  if (!code) return NO_DISCOUNT;
  const normalised = code.trim().toUpperCase();
  if (normalised === '') return NO_DISCOUNT;

  const row = await db
    .selectFrom('discounts')
    .select([
      'code', 'kind', 'value', 'min_subtotal as minSubtotal',
      'max_redemptions as maxRedemptions', 'redemptions',
      'starts_at as startsAt', 'ends_at as endsAt', 'is_active as isActive',
    ])
    .where('code', '=', normalised)
    .executeTakeFirst();

  if (!row || !row.isActive) return { ...NO_DISCOUNT, error: 'unknown' };

  const now = new Date();
  if ((row.startsAt && row.startsAt > now) || (row.endsAt && row.endsAt < now)) {
    return { ...NO_DISCOUNT, error: 'expired' };
  }
  if (row.maxRedemptions !== null && row.redemptions >= row.maxRedemptions) {
    return { ...NO_DISCOUNT, error: 'exhausted' };
  }
  if (row.minSubtotal !== null && compareMoney(subtotal, row.minSubtotal) < 0) {
    return { ...NO_DISCOUNT, error: 'min_subtotal' };
  }

  switch (row.kind) {
    case 'FREE_SHIPPING':
      return { code: row.code, amount: '0.000', freeShipping: true, error: null };
    case 'PERCENTAGE': {
      const amount = percentOfMoney(subtotal, Number(row.value));
      return { code: row.code, amount, freeShipping: false, error: null };
    }
    case 'FIXED_AMOUNT': {
      // A fixed discount can never exceed the subtotal, or the order goes negative.
      const amount = compareMoney(row.value, subtotal) > 0 ? subtotal : row.value;
      return { code: row.code, amount, freeShipping: false, error: null };
    }
  }
}

/** The one function that produces a payable total. Checkout calls this; so does the review step. */
export async function quoteOrder(
  input: {
    lines: RequestedLine[];
    fulfilment: FulfilmentMethod;
    governorate: string | null;
    discountCode: string | null;
    locale?: 'FR' | 'EN' | 'AR';
  },
  db: DB = defaultDb,
): Promise<Quote> {
  const priced = await priceLines(input.lines, input.locale ?? 'FR', db);
  const discount = await quoteDiscount(input.discountCode, priced.subtotal, db);
  const afterDiscount = subtractMoney(priced.subtotal, discount.amount);
  const shipping = await quoteShipping(input.fulfilment, input.governorate, afterDiscount, db);
  const shippingTotal = discount.freeShipping ? '0.000' : shipping.price;

  return {
    ...priced,
    discountCode: discount.code,
    discountTotal: discount.amount,
    shippingTotal,
    shippingAvailable: shipping.available,
    grandTotal: addMoney(afterDiscount, shippingTotal),
  };
}
