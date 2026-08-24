import 'server-only';
import { sql, type Transaction } from 'kysely';
import { db } from '@/db/client';
import type { Database } from '@/db/types';
import { newId } from '@/lib/ids';
import { AppError } from '@/lib/errors';
import { toJsonColumn } from '@/lib/json';
import { quoteOrder, type FulfilmentMethod, type Quote } from './pricing';
import { getProvider } from '@/modules/payments/provider';
import { enabledPaymentProviders, env } from '@/lib/env';
import type { DbLocale } from '@/i18n/config';

export type CreateOrderInput = {
  idempotencyKey: string;
  cartId: string;
  lines: { variantId: string; quantity: number }[];
  fulfilment: FulfilmentMethod;
  paymentProviderKey: string;
  locale: DbLocale;
  discountCode: string | null;
  customerId: string | null;
  contact: {
    email: string;
    phone: string;
    firstName: string;
    lastName: string;
    addressLine1?: string | null;
    addressLine2?: string | null;
    city?: string | null;
    governorate?: string | null;
    postalCode?: string | null;
    note?: string | null;
  };
  pickupPointId: string | null;
};

export type CreateOrderResult = {
  orderId: string;
  reference: string;
  redirectUrl: string | null;
  /** Set when the cart changed under the customer and the order was not created. */
  quote?: Quote;
};

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Human order reference: BOA-25-0001.
 *
 * The counter row is locked for the duration of the transaction, so two
 * simultaneous checkouts cannot receive the same number. A UUID would avoid the
 * lock but is unusable on a phone call, and BOA takes orders by phone.
 */
async function nextReference(
  trx: Transaction<Database>,
  scope: 'order' | 'reservation',
  prefix: string,
): Promise<string> {
  const period = String(new Date().getUTCFullYear()).slice(-2);

  await trx
    .insertInto('reference_counters')
    .values({ scope, period, next_value: 1 })
    .onDuplicateKeyUpdate((eb) => ({ next_value: eb.ref('reference_counters.next_value') }))
    .execute();

  const row = await trx
    .selectFrom('reference_counters')
    .select('next_value')
    .where('scope', '=', scope)
    .where('period', '=', period)
    .forUpdate()
    .executeTakeFirstOrThrow();

  await trx
    .updateTable('reference_counters')
    .set({ next_value: row.next_value + 1 })
    .where('scope', '=', scope)
    .where('period', '=', period)
    .execute();

  return `${prefix}-${period}-${String(row.next_value).padStart(4, '0')}`;
}

/**
 * Creates an order.
 *
 * Everything that matters happens in one transaction:
 *   1. the idempotency key is claimed, so a double submit resolves to the same
 *      order instead of minting a second one;
 *   2. prices, stock, shipping and discount are recomputed from the database —
 *      the client's numbers are never used;
 *   3. stock is decremented with a conditional UPDATE whose affected-row count
 *      is the authority. If another customer took the last unit a millisecond
 *      earlier, that UPDATE matches zero rows and the whole order rolls back;
 *   4. the order, its snapshot lines, its payment row and its first event are
 *      written together.
 *
 * If any step fails, nothing is written — there is no half-created order.
 */
export async function createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
  const provider = getProvider(input.paymentProviderKey);
  if (!provider || !enabledPaymentProviders.includes(provider.key)) {
    throw new AppError('validation_failed', 'Unknown payment method');
  }
  if (!provider.supports(input.fulfilment)) {
    throw new AppError('validation_failed', 'Payment method not available for this fulfilment');
  }
  if (input.fulfilment === 'STORE_PICKUP' && !input.pickupPointId) {
    throw new AppError('validation_failed', 'A pickup point is required');
  }
  if (input.fulfilment !== 'STORE_PICKUP' && !input.contact.addressLine1) {
    throw new AppError('validation_failed', 'A delivery address is required');
  }

  const result = await db.transaction().execute<CreateOrderResult>(async (trx) => {
    // 1 — claim the key. A duplicate means this exact submission already ran.
    const existing = await trx
      .selectFrom('idempotency_keys')
      .select(['result_id'])
      .where('key', '=', input.idempotencyKey)
      .executeTakeFirst();

    if (existing?.result_id) {
      const order = await trx
        .selectFrom('orders')
        .select(['id', 'reference'])
        .where('id', '=', existing.result_id)
        .executeTakeFirst();
      if (order) return { orderId: order.id, reference: order.reference, redirectUrl: null };
    }

    if (!existing) {
      await trx
        .insertInto('idempotency_keys')
        .values({
          key: input.idempotencyKey,
          scope: 'order.create',
          expires_at: new Date(Date.now() + IDEMPOTENCY_TTL_MS),
        })
        .execute();
    }

    // 2 — reprice from the database. Nothing the browser sent is trusted.
    const quote = await quoteOrder(
      {
        lines: input.lines,
        fulfilment: input.fulfilment,
        governorate: input.contact.governorate ?? null,
        discountCode: input.discountCode,
        locale: input.locale,
      },
      trx,
    );

    if (quote.lines.length === 0) throw new AppError('cart_empty', 'Cart is empty');
    if (quote.issues.length > 0) {
      throw new AppError('cart_changed', 'Cart changed during checkout', { quote });
    }
    if (!quote.shippingAvailable) {
      throw new AppError('validation_failed', 'No delivery configured for this governorate');
    }

    // 3 — commit stock. The WHERE clause is the concurrency control.
    for (const line of quote.lines) {
      const updated = await trx
        .updateTable('product_variants')
        .set((eb) => ({ stock: sql<number>`GREATEST(${eb.ref('stock')} - ${line.quantity}, 0)` }))
        .where('id', '=', line.variantId)
        .where((eb) =>
          eb.or([eb('allow_backorder', '=', true), eb('stock', '>=', line.quantity)]),
        )
        .executeTakeFirst();

      if (Number(updated.numUpdatedRows ?? 0) === 0) {
        throw new AppError('out_of_stock', `Insufficient stock for ${line.productName}`, {
          variantId: line.variantId,
          name: line.productName,
        });
      }

      await trx
        .insertInto('stock_movements')
        .values({
          variant_id: line.variantId,
          delta: -line.quantity,
          reason: 'ORDER_RESERVED',
          reference: input.idempotencyKey.slice(0, 64),
        })
        .execute();
    }

    // 4 — write the order and everything hanging off it.
    const orderId = newId();
    const reference = await nextReference(trx, 'order', 'BOA');

    const pickupName = input.pickupPointId
      ? (
          await trx
            .selectFrom('pickup_point_translations')
            .select('name')
            .where('point_id', '=', input.pickupPointId)
            .where('locale', '=', input.locale)
            .executeTakeFirst()
        )?.name ?? null
      : null;

    await trx
      .insertInto('orders')
      .values({
        id: orderId,
        reference,
        customer_id: input.customerId,
        status: 'PENDING',
        fulfilment: input.fulfilment,
        payment_method: provider.method,
        payment_status: 'UNPAID',
        currency: 'TND',
        locale: input.locale,
        subtotal: quote.subtotal,
        discount_total: quote.discountTotal,
        shipping_total: quote.shippingTotal,
        grand_total: quote.grandTotal,
        email: input.contact.email,
        phone: input.contact.phone,
        first_name: input.contact.firstName,
        last_name: input.contact.lastName,
        address_line1: input.contact.addressLine1 ?? null,
        address_line2: input.contact.addressLine2 ?? null,
        city: input.contact.city ?? null,
        governorate: input.contact.governorate ?? null,
        postal_code: input.contact.postalCode ?? null,
        country: 'TN',
        pickup_point_id: input.pickupPointId,
        pickup_point_name: pickupName,
        customer_note: input.contact.note ?? null,
        discount_code: quote.discountCode,
      })
      .execute();

    await trx
      .insertInto('order_lines')
      .values(
        quote.lines.map((line) => ({
          id: newId(),
          order_id: orderId,
          variant_id: line.variantId,
          product_id: line.productId,
          sku: line.sku,
          product_name: line.productName,
          variant_format: line.format,
          image_path: line.imagePath,
          unit_price: line.unitPrice,
          quantity: line.quantity,
          line_total: line.lineTotal,
        })),
      )
      .execute();

    if (quote.discountCode) {
      await trx
        .updateTable('discounts')
        .set((eb) => ({ redemptions: sql<number>`${eb.ref('redemptions')} + 1` }))
        .where('code', '=', quote.discountCode)
        .execute();
    }

    const payment = await provider.initiate({
      orderId,
      orderReference: reference,
      amount: quote.grandTotal,
      currency: 'TND',
      customerEmail: input.contact.email,
      locale: input.locale,
      returnUrl: `${env.NEXT_PUBLIC_SITE_URL}/api/payments/${provider.key}/return`,
    });

    await trx
      .insertInto('payments')
      .values({
        id: newId(),
        order_id: orderId,
        method: provider.method,
        status: 'UNPAID',
        amount: quote.grandTotal,
        currency: 'TND',
        provider: provider.key,
        provider_ref: payment.kind === 'redirect' ? payment.providerRef : null,
      })
      .execute();

    await trx
      .insertInto('order_events')
      .values({
        order_id: orderId,
        type: 'order.created',
        message: `Commande créée (${provider.key})`,
        data: toJsonColumn({ total: quote.grandTotal, lines: quote.lines.length }),
        actor: 'customer',
      })
      .execute();

    await trx
      .updateTable('idempotency_keys')
      .set({ result_id: orderId })
      .where('key', '=', input.idempotencyKey)
      .execute();

    await trx
      .updateTable('carts')
      .set({ converted_at: new Date() })
      .where('id', '=', input.cartId)
      .execute();

    return {
      orderId,
      reference,
      redirectUrl: payment.kind === 'redirect' ? payment.url : null,
    };
  });

  return result;
}

export type OrderDetail = {
  id: string;
  reference: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  fulfilment: string;
  placedAt: Date;
  subtotal: string;
  discountTotal: string;
  shippingTotal: string;
  grandTotal: string;
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  governorate: string | null;
  postalCode: string | null;
  pickupPointName: string | null;
  customerNote: string | null;
  lines: {
    id: string;
    sku: string;
    productName: string;
    variantFormat: string;
    imagePath: string | null;
    unitPrice: string;
    quantity: number;
    lineTotal: string;
  }[];
};

async function loadOrder(where: (q: ReturnType<typeof baseOrderQuery>) => ReturnType<typeof baseOrderQuery>) {
  const order = await where(baseOrderQuery()).executeTakeFirst();
  if (!order) return null;
  const lines = await db
    .selectFrom('order_lines')
    .select([
      'id', 'sku', 'product_name as productName', 'variant_format as variantFormat',
      'image_path as imagePath', 'unit_price as unitPrice', 'quantity', 'line_total as lineTotal',
    ])
    .where('order_id', '=', order.id)
    .execute();
  return { ...order, lines } as OrderDetail;
}

function baseOrderQuery() {
  return db
    .selectFrom('orders')
    .select([
      'id', 'reference', 'status', 'payment_status as paymentStatus',
      'payment_method as paymentMethod', 'fulfilment', 'placed_at as placedAt',
      'subtotal', 'discount_total as discountTotal', 'shipping_total as shippingTotal',
      'grand_total as grandTotal', 'email', 'phone', 'first_name as firstName',
      'last_name as lastName', 'address_line1 as addressLine1', 'address_line2 as addressLine2',
      'city', 'governorate', 'postal_code as postalCode',
      'pickup_point_name as pickupPointName', 'customer_note as customerNote',
    ]);
}

export const getOrderById = (id: string) => loadOrder((q) => q.where('orders.id', '=', id));

/**
 * Reference-only lookup. Used exclusively by the confirmation page, which is
 * gated by the httpOnly receipt cookie set at checkout — never by anything a
 * visitor can address directly.
 */
export const getOrderByReferenceUnsafe = (reference: string) =>
  loadOrder((q) => q.where('orders.reference', '=', reference));

/**
 * Looking an order up by reference requires the email too. Without that pairing,
 * BOA-25-0001 through BOA-25-0100 would be an enumerable list of customers'
 * names, addresses and phone numbers.
 */
export const getOrderByReference = (reference: string, email: string) =>
  loadOrder((q) =>
    q.where('orders.reference', '=', reference.trim().toUpperCase()).where('orders.email', '=', email.trim().toLowerCase()),
  );
