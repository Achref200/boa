import 'server-only';
import { sql, type Transaction } from 'kysely';
import { db } from '@/db/client';
import type { Database } from '@/db/types';
import { newId } from '@/lib/ids';
import { AppError } from '@/lib/errors';
import type { DbLocale } from '@/i18n/config';

export type CreateReservationInput = {
  idempotencyKey: string;
  serviceId: string;
  slotId: string;
  customerId: string | null;
  locale: DbLocale;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  note: string | null;
};

export type CreateReservationResult = {
  reservationId: string;
  reference: string;
  startsAt: Date;
  endsAt: Date;
  serviceName: string;
};

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

async function nextReference(trx: Transaction<Database>): Promise<string> {
  const period = String(new Date().getUTCFullYear()).slice(-2);

  await trx
    .insertInto('reference_counters')
    .values({ scope: 'reservation', period, next_value: 1 })
    .onDuplicateKeyUpdate((eb) => ({ next_value: eb.ref('reference_counters.next_value') }))
    .execute();

  const row = await trx
    .selectFrom('reference_counters')
    .select('next_value')
    .where('scope', '=', 'reservation')
    .where('period', '=', period)
    .forUpdate()
    .executeTakeFirstOrThrow();

  await trx
    .updateTable('reference_counters')
    .set({ next_value: row.next_value + 1 })
    .where('scope', '=', 'reservation')
    .where('period', '=', period)
    .execute();

  return `BOA-R-${period}-${String(row.next_value).padStart(4, '0')}`;
}

/**
 * Books one seat in a slot.
 *
 * Two independent guarantees, because one is not enough:
 *
 *   1. The slot row is locked `FOR UPDATE` before the occupied seats are
 *      counted, so two concurrent bookings serialise rather than both reading
 *      "one seat left".
 *   2. The seat row carries a unique index on (slot_id, seat_index). Even if a
 *      future code path forgets the lock — or the database is running at a
 *      weaker isolation level than expected — the second insert fails with a
 *      duplicate-key error and the whole transaction rolls back.
 *
 * The availability the customer saw is advisory. This function is the authority,
 * and it is allowed to say no to a slot the calendar showed as free.
 */
export async function createReservation(
  input: CreateReservationInput,
): Promise<CreateReservationResult> {
  return db.transaction().execute(async (trx) => {
    const existing = await trx
      .selectFrom('idempotency_keys')
      .select('result_id')
      .where('key', '=', input.idempotencyKey)
      .executeTakeFirst();

    if (existing?.result_id) {
      const previous = await trx
        .selectFrom('reservations')
        .select(['id', 'reference', 'starts_at as startsAt', 'ends_at as endsAt', 'service_name as serviceName'])
        .where('id', '=', existing.result_id)
        .executeTakeFirst();
      if (previous) {
        return {
          reservationId: previous.id,
          reference: previous.reference,
          startsAt: previous.startsAt,
          endsAt: previous.endsAt,
          serviceName: previous.serviceName,
        };
      }
    }

    if (!existing) {
      await trx
        .insertInto('idempotency_keys')
        .values({
          key: input.idempotencyKey,
          scope: 'reservation.create',
          expires_at: new Date(Date.now() + IDEMPOTENCY_TTL_MS),
        })
        .execute();
    }

    // (1) Lock the slot, then read it.
    const slot = await trx
      .selectFrom('slots')
      .select(['id', 'service_id as serviceId', 'starts_at as startsAt', 'ends_at as endsAt', 'capacity', 'is_blocked as isBlocked'])
      .where('id', '=', input.slotId)
      .where('service_id', '=', input.serviceId)
      .forUpdate()
      .executeTakeFirst();

    if (!slot || slot.isBlocked) throw new AppError('slot_unavailable', 'Slot is not bookable');
    if (slot.startsAt.getTime() <= Date.now()) {
      throw new AppError('slot_unavailable', 'Slot is in the past');
    }

    const seats = await trx
      .selectFrom('reservation_seats')
      .select((eb) => eb.fn.count<number>('id').as('taken'))
      .where('slot_id', '=', slot.id)
      .executeTakeFirst();

    const taken = Number(seats?.taken ?? 0);
    if (taken >= slot.capacity) throw new AppError('slot_unavailable', 'Slot is full');

    const service = await trx
      .selectFrom('services as s')
      .leftJoin('service_translations as t', (join) =>
        join.onRef('t.service_id', '=', 's.id').on('t.locale', '=', input.locale))
      .leftJoin('service_translations as f', (join) =>
        join.onRef('f.service_id', '=', 's.id').on('f.locale', '=', 'FR'))
      .leftJoin('pickup_points as p', 'p.id', 's.location_id')
      .leftJoin('pickup_point_translations as pt', (join) =>
        join.onRef('pt.point_id', '=', 'p.id').on('pt.locale', '=', input.locale))
      .select([
        's.price',
        sql<string>`COALESCE(t.name, f.name, s.slug)`.as('name'),
        sql<string | null>`pt.name`.as('locationName'),
      ])
      .where('s.id', '=', input.serviceId)
      .where('s.state', '=', 'PUBLISHED')
      .where('s.deleted_at', 'is', null)
      .executeTakeFirst();

    if (!service) throw new AppError('not_found', 'Service is not available');

    const reservationId = newId();
    const reference = await nextReference(trx);

    await trx
      .insertInto('reservations')
      .values({
        id: reservationId,
        reference,
        service_id: input.serviceId,
        slot_id: slot.id,
        customer_id: input.customerId,
        status: 'PENDING',
        // Snapshots, for the same reason order lines are snapshots.
        service_name: service.name,
        starts_at: slot.startsAt,
        ends_at: slot.endsAt,
        price_at_booking: service.price,
        location_name: service.locationName,
        first_name: input.firstName,
        last_name: input.lastName,
        email: input.email,
        phone: input.phone,
        note: input.note,
        locale: input.locale,
      })
      .execute();

    // (2) The unique index on (slot_id, seat_index) is the real guarantee.
    try {
      await trx
        .insertInto('reservation_seats')
        .values({ id: newId(), slot_id: slot.id, seat_index: taken, reservation_id: reservationId })
        .execute();
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === 'ER_DUP_ENTRY') throw new AppError('slot_unavailable', 'Slot was just taken');
      throw error;
    }

    await trx
      .updateTable('idempotency_keys')
      .set({ result_id: reservationId })
      .where('key', '=', input.idempotencyKey)
      .execute();

    return {
      reservationId,
      reference,
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
      serviceName: service.name,
    };
  });
}

/**
 * Cancelling frees the seat inside the same transaction that marks the
 * reservation cancelled, so a released seat can never be both occupied and
 * cancelled.
 */
export async function cancelReservation(
  reservationId: string,
  reason: string | null,
  actor: 'customer' | 'admin',
): Promise<void> {
  await db.transaction().execute(async (trx) => {
    const reservation = await trx
      .selectFrom('reservations')
      .select(['id', 'status'])
      .where('id', '=', reservationId)
      .forUpdate()
      .executeTakeFirst();

    if (!reservation) throw new AppError('not_found', 'Reservation not found');
    if (reservation.status === 'CANCELLED') return;
    if (reservation.status === 'COMPLETED' && actor === 'customer') {
      throw new AppError('forbidden', 'A completed reservation cannot be cancelled');
    }

    await trx.deleteFrom('reservation_seats').where('reservation_id', '=', reservationId).execute();
    await trx
      .updateTable('reservations')
      .set({ status: 'CANCELLED', cancelled_at: new Date(), cancel_reason: reason })
      .where('id', '=', reservationId)
      .execute();
  });
}

export type ReservationDetail = {
  id: string;
  reference: string;
  status: string;
  serviceName: string;
  startsAt: Date;
  endsAt: Date;
  locationName: string | null;
  priceAtBooking: string | null;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  note: string | null;
};

function baseReservationQuery() {
  return db
    .selectFrom('reservations')
    .select([
      'id', 'reference', 'status', 'service_name as serviceName',
      'starts_at as startsAt', 'ends_at as endsAt', 'location_name as locationName',
      'price_at_booking as priceAtBooking', 'first_name as firstName', 'last_name as lastName',
      'email', 'phone', 'note',
    ]);
}

export const getReservationById = (id: string): Promise<ReservationDetail | undefined> =>
  baseReservationQuery().where('id', '=', id).executeTakeFirst();

/** Same pairing rule as orders: a reference alone would be enumerable. */
export const getReservationByReference = (
  reference: string,
  email: string,
): Promise<ReservationDetail | undefined> =>
  baseReservationQuery()
    .where('reference', '=', reference.trim().toUpperCase())
    .where('email', '=', email.trim().toLowerCase())
    .executeTakeFirst();
