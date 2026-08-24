import 'server-only';
import { db } from '@/db/client';
import { newId } from '@/lib/ids';
import { AppError } from '@/lib/errors';

/**
 * Everything the account area reads.
 *
 * Every query here is scoped by `customer_id` in the WHERE clause — never by
 * trusting an id that arrived in a URL. That is the whole authorization model
 * for this area, and it is deliberately impossible to forget: there is no
 * "get order by id" that does not also take the customer.
 */
export async function getCustomerOrders(customerId: string, page = 1) {
  const perPage = 10;
  const [rows, total] = await Promise.all([
    db
      .selectFrom('orders')
      .select([
        'id', 'reference', 'status', 'payment_status as paymentStatus',
        'grand_total as grandTotal', 'placed_at as placedAt', 'fulfilment',
      ])
      .where('customer_id', '=', customerId)
      .orderBy('placed_at', 'desc')
      .limit(perPage)
      .offset((page - 1) * perPage)
      .execute(),
    db
      .selectFrom('orders')
      .select((eb) => eb.fn.countAll<number>().as('count'))
      .where('customer_id', '=', customerId)
      .executeTakeFirst(),
  ]);

  const count = Number(total?.count ?? 0);
  return { rows, total: count, page, perPage, pageCount: Math.max(1, Math.ceil(count / perPage)) };
}

export async function getCustomerOrder(customerId: string, reference: string) {
  const order = await db
    .selectFrom('orders')
    .selectAll()
    .where('customer_id', '=', customerId)
    .where('reference', '=', reference)
    .executeTakeFirst();
  if (!order) return null;

  const lines = await db
    .selectFrom('order_lines')
    .select([
      'id', 'sku', 'product_name as productName', 'variant_format as variantFormat',
      'image_path as imagePath', 'unit_price as unitPrice', 'quantity', 'line_total as lineTotal',
    ])
    .where('order_id', '=', order.id)
    .execute();

  return { order, lines };
}

export async function getCustomerReservations(customerId: string) {
  return db
    .selectFrom('reservations')
    .select([
      'id', 'reference', 'status', 'service_name as serviceName',
      'starts_at as startsAt', 'ends_at as endsAt', 'location_name as locationName',
    ])
    .where('customer_id', '=', customerId)
    .orderBy('starts_at', 'desc')
    .limit(50)
    .execute();
}

export async function getCustomerAddresses(customerId: string) {
  return db
    .selectFrom('addresses')
    .select([
      'id', 'label', 'first_name as firstName', 'last_name as lastName', 'phone',
      'line1', 'line2', 'city', 'governorate', 'postal_code as postalCode',
      'is_default as isDefault',
    ])
    .where('customer_id', '=', customerId)
    .where('deleted_at', 'is', null)
    .orderBy('is_default', 'desc')
    .orderBy('created_at', 'desc')
    .execute();
}

export type AddressInput = {
  id?: string | undefined;
  label: string | null;
  firstName: string;
  lastName: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  governorate: string;
  postalCode: string | null;
  isDefault: boolean;
};

export async function saveAddress(customerId: string, input: AddressInput): Promise<string> {
  return db.transaction().execute(async (trx) => {
    if (input.isDefault) {
      await trx
        .updateTable('addresses')
        .set({ is_default: false })
        .where('customer_id', '=', customerId)
        .execute();
    }

    const values = {
      label: input.label,
      first_name: input.firstName,
      last_name: input.lastName,
      phone: input.phone,
      line1: input.line1,
      line2: input.line2,
      city: input.city,
      governorate: input.governorate,
      postal_code: input.postalCode,
      is_default: input.isDefault,
    };

    if (input.id) {
      // Ownership is part of the WHERE clause, not a separate check that could
      // be skipped: another customer's address id simply matches nothing.
      const updated = await trx
        .updateTable('addresses')
        .set(values)
        .where('id', '=', input.id)
        .where('customer_id', '=', customerId)
        .executeTakeFirst();
      if (Number(updated.numUpdatedRows ?? 0) === 0) throw new AppError('not_found', 'address_not_found');
      return input.id;
    }

    const id = newId();
    await trx.insertInto('addresses').values({ id, customer_id: customerId, ...values }).execute();
    return id;
  });
}

/** Soft delete: an address may be referenced by nothing, but the row is cheap and the audit is useful. */
export async function deleteAddress(customerId: string, id: string): Promise<void> {
  await db
    .updateTable('addresses')
    .set({ deleted_at: new Date(), is_default: false })
    .where('id', '=', id)
    .where('customer_id', '=', customerId)
    .execute();
}

export async function updateProfile(
  customerId: string,
  input: { firstName: string; lastName: string; phone: string | null },
): Promise<void> {
  await db
    .updateTable('customers')
    .set({ first_name: input.firstName, last_name: input.lastName, phone: input.phone })
    .where('id', '=', customerId)
    .execute();
}
