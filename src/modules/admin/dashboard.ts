import 'server-only';
import { sql } from 'kysely';
import { db } from '@/db/client';
import { parseJson } from '@/lib/json';
import { addMoney } from '@/lib/money';
import type { MoneyString } from '@/lib/money';

/**
 * The dashboard answers operational questions, not vanity ones.
 *
 * Every figure below is a live query against real rows. There are no sample
 * numbers, no synthetic trend lines, and nothing is rendered when the
 * underlying table is empty — an admin who sees "0 orders to handle" on day one
 * is being told the truth, which is more useful than a decorative chart.
 */
export type DashboardData = {
  ordersToHandle: number;
  reservationsToday: number;
  lowStockCount: number;
  revenue30d: MoneyString;
  orders30d: number;
  newCustomers30d: number;
  unhandledInquiries: number;
  recentOrders: {
    id: string;
    reference: string;
    customerName: string;
    status: string;
    paymentStatus: string;
    grandTotal: MoneyString;
    placedAt: Date;
  }[];
  upcomingReservations: {
    id: string;
    reference: string;
    serviceName: string;
    customerName: string;
    status: string;
    startsAt: Date;
  }[];
  lowStock: { id: string; sku: string; productName: string; format: string; stock: number; lowStockAt: number }[];
  contentToComplete: string[];
  /** Daily revenue for the last 30 days — only rendered when there is data to plot. */
  revenueSeries: { date: string; total: MoneyString; orders: number }[];
};

const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);

/** Orders that are cancelled or refunded are excluded from every revenue figure. */
const EARNING_STATUSES = ['PENDING', 'CONFIRMED', 'PREPARING', 'SHIPPED', 'READY_FOR_PICKUP', 'COMPLETED'] as const;

export async function getDashboardData(): Promise<DashboardData> {
  const since = daysAgo(30);
  const startOfToday = new Date();
  startOfToday.setUTCHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);

  const [
    ordersToHandle,
    reservationsToday,
    lowStockRows,
    revenueRows,
    newCustomers,
    unhandledInquiries,
    recentOrders,
    upcomingReservations,
    settingsRow,
  ] = await Promise.all([
    db
      .selectFrom('orders')
      .select((eb) => eb.fn.countAll<number>().as('count'))
      .where('status', 'in', ['PENDING', 'CONFIRMED', 'PREPARING'])
      .executeTakeFirst(),

    db
      .selectFrom('reservations')
      .select((eb) => eb.fn.countAll<number>().as('count'))
      .where('starts_at', '>=', startOfToday)
      .where('starts_at', '<', endOfToday)
      .where('status', 'in', ['PENDING', 'CONFIRMED'])
      .executeTakeFirst(),

    db
      .selectFrom('product_variants as v')
      .innerJoin('products as p', 'p.id', 'v.product_id')
      .leftJoin('product_translations as t', (join) =>
        join.onRef('t.product_id', '=', 'p.id').on('t.locale', '=', 'FR'))
      .select([
        'v.id', 'v.sku', 'v.format', 'v.stock', 'v.low_stock_at as lowStockAt',
        sql<string>`COALESCE(t.name, p.slug)`.as('productName'),
      ])
      .where('v.is_active', '=', true)
      .where('p.deleted_at', 'is', null)
      .where('p.state', '=', 'PUBLISHED')
      .where('v.allow_backorder', '=', false)
      .whereRef('v.stock', '<=', 'v.low_stock_at')
      .orderBy('v.stock')
      .limit(20)
      .execute(),

    // Grouped in SQL, summed with exact decimal arithmetic in TypeScript: MySQL
    // would happily give a float back through a driver that coerces.
    db
      .selectFrom('orders')
      .select([
        sql<string>`DATE(placed_at)`.as('date'),
        sql<string>`CAST(SUM(grand_total) AS CHAR)`.as('total'),
        sql<number>`COUNT(*)`.as('orders'),
      ])
      .where('placed_at', '>=', since)
      .where('status', 'in', EARNING_STATUSES)
      .groupBy(sql`DATE(placed_at)`)
      .orderBy(sql`DATE(placed_at)`)
      .execute(),

    db
      .selectFrom('customers')
      .select((eb) => eb.fn.countAll<number>().as('count'))
      .where('created_at', '>=', since)
      .where('deleted_at', 'is', null)
      .executeTakeFirst(),

    db
      .selectFrom('inquiries')
      .select((eb) => eb.fn.countAll<number>().as('count'))
      .where('is_handled', '=', false)
      .executeTakeFirst(),

    db
      .selectFrom('orders')
      .select([
        'id', 'reference', 'status', 'payment_status as paymentStatus',
        'grand_total as grandTotal', 'placed_at as placedAt',
        sql<string>`CONCAT(first_name, ' ', last_name)`.as('customerName'),
      ])
      .orderBy('placed_at', 'desc')
      .limit(8)
      .execute(),

    db
      .selectFrom('reservations')
      .select([
        'id', 'reference', 'service_name as serviceName', 'status', 'starts_at as startsAt',
        sql<string>`CONCAT(first_name, ' ', last_name)`.as('customerName'),
      ])
      .where('starts_at', '>=', new Date())
      .where('status', 'in', ['PENDING', 'CONFIRMED'])
      .orderBy('starts_at')
      .limit(8)
      .execute(),

    db
      .selectFrom('settings')
      .select('value')
      .where('key', '=', 'contentToComplete')
      .executeTakeFirst(),
  ]);

  const series = revenueRows.map((row) => ({
    date: String(row.date).slice(0, 10),
    total: normaliseMoney(row.total),
    orders: Number(row.orders),
  }));

  return {
    ordersToHandle: Number(ordersToHandle?.count ?? 0),
    reservationsToday: Number(reservationsToday?.count ?? 0),
    lowStockCount: lowStockRows.length,
    revenue30d: series.length > 0 ? addMoney(...series.map((entry) => entry.total)) : '0.000',
    orders30d: series.reduce((sum, entry) => sum + entry.orders, 0),
    newCustomers30d: Number(newCustomers?.count ?? 0),
    unhandledInquiries: Number(unhandledInquiries?.count ?? 0),
    recentOrders,
    upcomingReservations,
    lowStock: lowStockRows,
    contentToComplete: parseJson<string[]>(settingsRow?.value, []),
    revenueSeries: series,
  };
}

/** SUM() can come back as "24.900" or "24.9" depending on driver settings. */
function normaliseMoney(value: string | null): MoneyString {
  if (!value) return '0.000';
  const [whole = '0', fraction = ''] = value.split('.');
  return `${whole}.${fraction.padEnd(3, '0').slice(0, 3)}`;
}
