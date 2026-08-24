import 'server-only';
import { sql } from 'kysely';
import { db } from '@/db/client';
import { newId } from '@/lib/ids';
import { AppError } from '@/lib/errors';
import { cancelReservation } from '@/modules/reservations/booking';

/**
 * A DATE column round-trips as a Date in the query builder, so an ISO day
 * string has to be lifted to midnight UTC. The driver is configured with
 * timezone 'Z', and MySQL truncates the time part for a DATE column.
 */
const dateOnly = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);

export type ReservationStatus = 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';

/**
 * A reservation's lifecycle. `CANCELLED` is handled separately because it also
 * has to free the seat — see `cancelReservation`.
 */
export const RESERVATION_TRANSITIONS: Record<ReservationStatus, ReservationStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['COMPLETED', 'NO_SHOW', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
};

export async function listReservations(query: {
  search?: string | undefined;
  status?: ReservationStatus | undefined;
  serviceId?: string | undefined;
  from?: Date | undefined;
  page?: number | undefined;
  perPage?: number | undefined;
}) {
  const page = Math.max(1, query.page ?? 1);
  const perPage = Math.min(100, query.perPage ?? 25);

  let base = db.selectFrom('reservations');
  if (query.status) base = base.where('status', '=', query.status);
  if (query.serviceId) base = base.where('service_id', '=', query.serviceId);
  if (query.from) base = base.where('starts_at', '>=', query.from);
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
        'id', 'reference', 'status', 'service_name as serviceName',
        'starts_at as startsAt', 'ends_at as endsAt', 'email', 'phone',
        'location_name as locationName', 'note',
        sql<string>`CONCAT(first_name, ' ', last_name)`.as('customerName'),
      ])
      .orderBy('starts_at', 'asc')
      .limit(perPage)
      .offset((page - 1) * perPage)
      .execute(),
    base.select((eb) => eb.fn.countAll<number>().as('count')).executeTakeFirst(),
  ]);

  const count = Number(total?.count ?? 0);
  return { rows, total: count, page, perPage, pageCount: Math.max(1, Math.ceil(count / perPage)) };
}

export async function changeReservationStatus(
  id: string,
  next: ReservationStatus,
  reason?: string,
): Promise<void> {
  if (next === 'CANCELLED') {
    await cancelReservation(id, reason ?? null, 'admin');
    return;
  }

  const reservation = await db
    .selectFrom('reservations')
    .select(['status'])
    .where('id', '=', id)
    .executeTakeFirst();
  if (!reservation) throw new AppError('not_found', 'reservation_not_found');

  const allowed = RESERVATION_TRANSITIONS[reservation.status as ReservationStatus];
  if (!allowed.includes(next)) throw new AppError('conflict', 'invalid_transition');

  await db
    .updateTable('reservations')
    .set({ status: next, confirmed_at: next === 'CONFIRMED' ? new Date() : undefined })
    .where('id', '=', id)
    .execute();
}

/**
 * Closures and one-off openings. An exception on a date the service already has
 * bookings does not delete them — the slots stay, the reservations stay, and
 * only *new* bookings are prevented. Silently cancelling a customer's
 * appointment because an admin marked a day closed would be far worse than
 * making them cancel it explicitly.
 */
export async function setAvailabilityException(input: {
  serviceId: string;
  date: string;
  isOpen: boolean;
  startMin?: number | null;
  endMin?: number | null;
  reason?: string | null;
}): Promise<void> {
  const existing = await db
    .selectFrom('availability_exceptions')
    .select('id')
    .where('service_id', '=', input.serviceId)
    .where('date', '=', dateOnly(input.date))
    .executeTakeFirst();

  const values = {
    is_open: input.isOpen,
    start_min: input.startMin ?? null,
    end_min: input.endMin ?? null,
    reason: input.reason ?? null,
  };

  if (existing) {
    await db.updateTable('availability_exceptions').set(values).where('id', '=', existing.id).execute();
  } else {
    await db
      .insertInto('availability_exceptions')
      .values({ id: newId(), service_id: input.serviceId, date: dateOnly(input.date), ...values })
      .execute();
  }

  // Block the generated slots for a closed day so the calendar reflects it
  // immediately, without touching anything already booked.
  if (!input.isOpen) {
    await db
      .updateTable('slots')
      .set({ is_blocked: true })
      .where('service_id', '=', input.serviceId)
      .where(sql`DATE(starts_at)`, '=', input.date)
      .execute();
  } else {
    await db
      .updateTable('slots')
      .set({ is_blocked: false })
      .where('service_id', '=', input.serviceId)
      .where(sql`DATE(starts_at)`, '=', input.date)
      .execute();
  }
}

export async function removeAvailabilityException(serviceId: string, date: string): Promise<void> {
  await db
    .deleteFrom('availability_exceptions')
    .where('service_id', '=', serviceId)
    .where('date', '=', dateOnly(date))
    .execute();
  await db
    .updateTable('slots')
    .set({ is_blocked: false })
    .where('service_id', '=', serviceId)
    .where(sql`DATE(starts_at)`, '=', date)
    .execute();
}

export async function listAvailabilityExceptions(serviceId: string) {
  return db
    .selectFrom('availability_exceptions')
    .select(['id', 'date', 'is_open as isOpen', 'start_min as startMin', 'end_min as endMin', 'reason'])
    .where('service_id', '=', serviceId)
    .orderBy('date')
    .execute();
}
