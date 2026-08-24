import 'server-only';
import { sql } from 'kysely';
import { db } from '@/db/client';
import { AppError } from '@/lib/errors';
import { toJsonColumn } from '@/lib/json';

/**
 * The order status machine.
 *
 * Encoded as data rather than as `if` statements scattered through the admin,
 * so "can this order be marked shipped?" has exactly one answer and the UI can
 * derive its buttons from the same table the server validates against.
 */
export type OrderStatus =
  | 'PENDING' | 'CONFIRMED' | 'PREPARING' | 'SHIPPED'
  | 'READY_FOR_PICKUP' | 'COMPLETED' | 'CANCELLED' | 'REFUNDED';

export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PREPARING', 'CANCELLED'],
  // Which "out the door" state applies depends on the fulfilment method; both
  // are listed and the caller filters, so the machine stays declarative.
  PREPARING: ['SHIPPED', 'READY_FOR_PICKUP', 'CANCELLED'],
  SHIPPED: ['COMPLETED', 'CANCELLED'],
  READY_FOR_PICKUP: ['COMPLETED', 'CANCELLED'],
  COMPLETED: ['REFUNDED'],
  CANCELLED: [],
  REFUNDED: [],
};

export const PAYMENT_TRANSITIONS = {
  UNPAID: ['PAID', 'FAILED', 'CANCELLED'],
  AUTHORIZED: ['PAID', 'FAILED', 'CANCELLED'],
  PAID: ['REFUNDED'],
  FAILED: ['UNPAID', 'PAID'],
  REFUNDED: [],
  CANCELLED: [],
} as const;

export function allowedOrderTransitions(
  status: OrderStatus,
  fulfilment: 'DELIVERY' | 'HAND_TO_HAND' | 'STORE_PICKUP',
): OrderStatus[] {
  return ORDER_TRANSITIONS[status].filter((next) => {
    if (next === 'SHIPPED') return fulfilment !== 'STORE_PICKUP';
    if (next === 'READY_FOR_PICKUP') return fulfilment === 'STORE_PICKUP';
    return true;
  });
}

export type AdminOrderQuery = {
  search?: string | undefined;
  status?: OrderStatus | undefined;
  page?: number | undefined;
  perPage?: number | undefined;
};

export async function listOrders(query: AdminOrderQuery) {
  const page = Math.max(1, query.page ?? 1);
  const perPage = Math.min(100, query.perPage ?? 25);

  let base = db.selectFrom('orders');
  if (query.status) base = base.where('status', '=', query.status);
  if (query.search) {
    const term = `%${query.search.trim().slice(0, 60)}%`;
    base = base.where((eb) =>
      eb.or([
        eb('reference', 'like', term),
        eb('email', 'like', term),
        eb('phone', 'like', term),
        eb(sql`CONCAT(first_name, ' ', last_name)`, 'like', term),
      ]),
    );
  }

  const [rows, total] = await Promise.all([
    base
      .select([
        'id', 'reference', 'status', 'payment_status as paymentStatus',
        'fulfilment', 'grand_total as grandTotal', 'placed_at as placedAt', 'email',
        sql<string>`CONCAT(first_name, ' ', last_name)`.as('customerName'),
      ])
      .orderBy('placed_at', 'desc')
      .limit(perPage)
      .offset((page - 1) * perPage)
      .execute(),
    base.select((eb) => eb.fn.countAll<number>().as('count')).executeTakeFirst(),
  ]);

  const count = Number(total?.count ?? 0);
  return { rows, total: count, page, perPage, pageCount: Math.max(1, Math.ceil(count / perPage)) };
}

export async function getOrderDetail(id: string) {
  const order = await db
    .selectFrom('orders')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirst();
  if (!order) return null;

  const [lines, events, payments] = await Promise.all([
    db.selectFrom('order_lines').selectAll().where('order_id', '=', id).execute(),
    db
      .selectFrom('order_events')
      .select(['id', 'type', 'message', 'actor', 'created_at as createdAt'])
      .where('order_id', '=', id)
      .orderBy('created_at', 'desc')
      .limit(50)
      .execute(),
    db
      .selectFrom('payments')
      .select(['id', 'method', 'status', 'amount', 'provider', 'provider_ref as providerRef', 'paid_at as paidAt'])
      .where('order_id', '=', id)
      .execute(),
  ]);

  return { order, lines, events, payments };
}

/**
 * Changing an order's status is transactional and restocks on cancellation.
 *
 * Cancelling an order that had already decremented stock has to put the units
 * back, or the catalogue slowly bleeds inventory every time an order falls
 * through — a bug that is invisible until a stock count months later.
 */
export async function changeOrderStatus(
  orderId: string,
  next: OrderStatus,
  actor: string,
  reason?: string,
): Promise<void> {
  await db.transaction().execute(async (trx) => {
    const order = await trx
      .selectFrom('orders')
      .select(['id', 'status', 'fulfilment', 'reference'])
      .where('id', '=', orderId)
      .forUpdate()
      .executeTakeFirst();
    if (!order) throw new AppError('not_found', 'order_not_found');

    const allowed = allowedOrderTransitions(
      order.status as OrderStatus,
      order.fulfilment as 'DELIVERY' | 'HAND_TO_HAND' | 'STORE_PICKUP',
    );
    if (!allowed.includes(next)) throw new AppError('conflict', 'invalid_transition');

    const restocks = next === 'CANCELLED' || next === 'REFUNDED';
    if (restocks) {
      const lines = await trx
        .selectFrom('order_lines')
        .select(['variant_id as variantId', 'quantity'])
        .where('order_id', '=', orderId)
        .execute();

      for (const line of lines) {
        if (!line.variantId) continue;
        await trx
          .updateTable('product_variants')
          .set((eb) => ({ stock: sql<number>`${eb.ref('stock')} + ${line.quantity}` }))
          .where('id', '=', line.variantId)
          .execute();
        await trx
          .insertInto('stock_movements')
          .values({
            variant_id: line.variantId,
            delta: line.quantity,
            reason: 'ORDER_RELEASED',
            reference: order.reference,
          })
          .execute();
      }
    }

    await trx
      .updateTable('orders')
      .set({
        status: next,
        confirmed_at: next === 'CONFIRMED' ? new Date() : undefined,
        completed_at: next === 'COMPLETED' ? new Date() : undefined,
        cancelled_at: next === 'CANCELLED' ? new Date() : undefined,
        cancel_reason: next === 'CANCELLED' ? (reason ?? null) : undefined,
      })
      .where('id', '=', orderId)
      .execute();

    await trx
      .insertInto('order_events')
      .values({
        order_id: orderId,
        type: 'status.changed',
        message: `${order.status} → ${next}`,
        data: toJsonColumn({ from: order.status, to: next, reason: reason ?? null }),
        actor,
      })
      .execute();
  });
}

export async function changePaymentStatus(
  orderId: string,
  next: keyof typeof PAYMENT_TRANSITIONS,
  actor: string,
): Promise<void> {
  await db.transaction().execute(async (trx) => {
    const order = await trx
      .selectFrom('orders')
      .select(['id', 'payment_status as paymentStatus'])
      .where('id', '=', orderId)
      .forUpdate()
      .executeTakeFirst();
    if (!order) throw new AppError('not_found', 'order_not_found');

    const allowed = PAYMENT_TRANSITIONS[order.paymentStatus as keyof typeof PAYMENT_TRANSITIONS];
    if (!allowed.includes(next as never)) throw new AppError('conflict', 'invalid_transition');

    await trx
      .updateTable('orders')
      .set({ payment_status: next })
      .where('id', '=', orderId)
      .execute();

    await trx
      .updateTable('payments')
      .set({ status: next, paid_at: next === 'PAID' ? new Date() : null })
      .where('order_id', '=', orderId)
      .execute();

    await trx
      .insertInto('order_events')
      .values({
        order_id: orderId,
        type: 'payment.changed',
        message: `${order.paymentStatus} → ${next}`,
        actor,
      })
      .execute();
  });
}

export async function addOrderNote(orderId: string, note: string, actor: string): Promise<void> {
  await db.updateTable('orders').set({ internal_note: note }).where('id', '=', orderId).execute();
  await db
    .insertInto('order_events')
    .values({ order_id: orderId, type: 'note.added', message: note.slice(0, 255), actor })
    .execute();
}
