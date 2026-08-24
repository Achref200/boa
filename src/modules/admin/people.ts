import 'server-only';
import { sql } from 'kysely';
import { db } from '@/db/client';

/**
 * Customers and inbound messages. Both are read-mostly in v1: BOA's team needs
 * to look someone up before a phone call, not to edit their profile behind
 * their back.
 */
export async function listCustomers(query: {
  search?: string | undefined;
  page?: number | undefined;
  perPage?: number | undefined;
}) {
  const page = Math.max(1, query.page ?? 1);
  const perPage = Math.min(100, query.perPage ?? 25);

  let base = db.selectFrom('customers as c').where('c.deleted_at', 'is', null);

  if (query.search) {
    const term = `%${query.search.trim().slice(0, 60)}%`;
    base = base.where((eb) =>
      eb.or([
        eb('c.email', 'like', term),
        eb('c.phone', 'like', term),
        eb(sql`CONCAT(COALESCE(c.first_name, ''), ' ', COALESCE(c.last_name, ''))`, 'like', term),
      ]),
    );
  }

  const [rows, total] = await Promise.all([
    base
      .select((eb) => [
        'c.id',
        'c.email',
        'c.phone',
        'c.created_at as createdAt',
        sql<string>`TRIM(CONCAT(COALESCE(c.first_name, ''), ' ', COALESCE(c.last_name, '')))`.as('name'),
        sql<number>`c.password_hash IS NOT NULL`.as('hasAccount'),
        eb
          .selectFrom('orders')
          .select(({ fn }) => fn.countAll<number>().as('count'))
          .whereRef('orders.customer_id', '=', 'c.id')
          .as('orderCount'),
        eb
          .selectFrom('orders')
          .select(sql<string>`CAST(COALESCE(SUM(grand_total), 0) AS CHAR)`.as('sum'))
          .whereRef('orders.customer_id', '=', 'c.id')
          .where('orders.status', 'not in', ['CANCELLED', 'REFUNDED'])
          .as('lifetimeValue'),
      ])
      .orderBy('c.created_at', 'desc')
      .limit(perPage)
      .offset((page - 1) * perPage)
      .execute(),
    base.select((eb) => eb.fn.countAll<number>().as('count')).executeTakeFirst(),
  ]);

  const count = Number(total?.count ?? 0);
  return {
    rows: rows.map((row) => ({
      ...row,
      hasAccount: Boolean(row.hasAccount),
      orderCount: Number(row.orderCount ?? 0),
      lifetimeValue: normalise(row.lifetimeValue),
    })),
    total: count,
    page,
    perPage,
    pageCount: Math.max(1, Math.ceil(count / perPage)),
  };
}

function normalise(value: string | null | undefined): string {
  if (!value) return '0.000';
  const [whole = '0', fraction = ''] = String(value).split('.');
  return `${whole}.${fraction.padEnd(3, '0').slice(0, 3)}`;
}

export async function listInquiries(query: { handled?: boolean | undefined; page?: number | undefined }) {
  const page = Math.max(1, query.page ?? 1);
  const perPage = 25;

  let base = db.selectFrom('inquiries');
  if (query.handled !== undefined) base = base.where('is_handled', '=', query.handled);

  const [rows, total] = await Promise.all([
    base
      .select([
        'id', 'kind', 'name', 'email', 'phone', 'company', 'subject', 'message',
        'is_handled as isHandled', 'created_at as createdAt',
      ])
      .orderBy('created_at', 'desc')
      .limit(perPage)
      .offset((page - 1) * perPage)
      .execute(),
    base.select((eb) => eb.fn.countAll<number>().as('count')).executeTakeFirst(),
  ]);

  const count = Number(total?.count ?? 0);
  return { rows, total: count, page, perPage, pageCount: Math.max(1, Math.ceil(count / perPage)) };
}

export async function setInquiryHandled(id: string, handled: boolean): Promise<void> {
  await db.updateTable('inquiries').set({ is_handled: handled }).where('id', '=', id).execute();
}
