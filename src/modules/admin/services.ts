import 'server-only';
import { sql } from 'kysely';
import { db } from '@/db/client';
import { newId } from '@/lib/ids';
import { AppError } from '@/lib/errors';
import type { DbLocale } from '@/i18n/config';

export type AdminServiceRow = {
  id: string;
  slug: string;
  state: string;
  durationMin: number;
  capacity: number;
  price: string | null;
  name: string;
  locationName: string | null;
  upcomingReservations: number;
};

export async function listServices(): Promise<AdminServiceRow[]> {
  const rows = await db
    .selectFrom('services as s')
    .leftJoin('service_translations as t', (join) =>
      join.onRef('t.service_id', '=', 's.id').on('t.locale', '=', 'FR'))
    .leftJoin('pickup_point_translations as pt', (join) =>
      join.onRef('pt.point_id', '=', 's.location_id').on('pt.locale', '=', 'FR'))
    .select((eb) => [
      's.id', 's.slug', 's.state', 's.duration_min as durationMin', 's.capacity', 's.price',
      sql<string>`COALESCE(t.name, s.slug)`.as('name'),
      sql<string | null>`pt.name`.as('locationName'),
      eb
        .selectFrom('reservations')
        .select(({ fn }) => fn.countAll<number>().as('count'))
        .whereRef('reservations.service_id', '=', 's.id')
        .where('reservations.starts_at', '>=', new Date())
        .where('reservations.status', 'in', ['PENDING', 'CONFIRMED'])
        .as('upcomingReservations'),
    ])
    .where('s.deleted_at', 'is', null)
    .orderBy('s.position')
    .execute();

  return rows.map((row) => ({ ...row, upcomingReservations: Number(row.upcomingReservations ?? 0) }));
}

export async function getServiceForEdit(id: string) {
  const service = await db
    .selectFrom('services')
    .select([
      'id', 'slug', 'state', 'duration_min as durationMin', 'capacity', 'price',
      'deposit_amount as depositAmount', 'buffer_min as bufferMin',
      'lead_time_hours as leadTimeHours', 'horizon_days as horizonDays',
      'location_id as locationId', 'position',
    ])
    .where('id', '=', id)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (!service) return null;

  const [translations, rules, exceptions] = await Promise.all([
    db
      .selectFrom('service_translations')
      .select(['locale', 'name', 'tagline', 'description', 'preparation', 'meta_title as metaTitle', 'meta_description as metaDescription'])
      .where('service_id', '=', id)
      .execute(),
    db
      .selectFrom('availability_rules')
      .select(['id', 'weekday', 'start_min as startMin', 'end_min as endMin', 'slot_every_min as slotEveryMin', 'is_active as isActive'])
      .where('service_id', '=', id)
      .orderBy('weekday')
      .orderBy('start_min')
      .execute(),
    db
      .selectFrom('availability_exceptions')
      .select(['id', 'date', 'is_open as isOpen', 'start_min as startMin', 'end_min as endMin', 'reason'])
      .where('service_id', '=', id)
      .orderBy('date')
      .execute(),
  ]);

  return { ...service, translations, rules, exceptions };
}

export type ServiceInput = {
  id?: string | undefined;
  slug: string;
  state: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  durationMin: number;
  capacity: number;
  price: string | null;
  bufferMin: number;
  leadTimeHours: number;
  horizonDays: number;
  locationId: string | null;
  position: number;
  translations: {
    locale: DbLocale;
    name: string;
    tagline: string | null;
    description: string | null;
    preparation: string | null;
  }[];
  rules: { weekday: number; startMin: number; endMin: number; slotEveryMin: number }[];
};

/**
 * Saving a service replaces its weekly rules but never its materialised slots.
 *
 * Slots that already exist keep the capacity they were generated with, and any
 * slot that is already booked is untouched — changing "Tuesdays now start at
 * 10:00" must not silently move an appointment a customer already holds. New
 * rules only affect slots generated from this point on.
 */
export async function saveService(input: ServiceInput): Promise<string> {
  return db.transaction().execute(async (trx) => {
    const id = input.id ?? newId();

    const clash = await trx
      .selectFrom('services')
      .select('id')
      .where('slug', '=', input.slug)
      .where('id', '!=', id)
      .executeTakeFirst();
    if (clash) throw new AppError('conflict', 'slug_taken');

    const values = {
      slug: input.slug,
      state: input.state,
      duration_min: input.durationMin,
      capacity: input.capacity,
      price: input.price,
      buffer_min: input.bufferMin,
      lead_time_hours: input.leadTimeHours,
      horizon_days: input.horizonDays,
      location_id: input.locationId,
      position: input.position,
    };

    if (input.id) {
      await trx.updateTable('services').set(values).where('id', '=', id).execute();
    } else {
      await trx.insertInto('services').values({ id, ...values }).execute();
    }

    for (const translation of input.translations) {
      const existing = await trx
        .selectFrom('service_translations')
        .select('id')
        .where('service_id', '=', id)
        .where('locale', '=', translation.locale)
        .executeTakeFirst();

      const row = {
        name: translation.name,
        tagline: translation.tagline,
        description: translation.description,
        preparation: translation.preparation,
      };

      if (existing) {
        await trx.updateTable('service_translations').set(row).where('id', '=', existing.id).execute();
      } else {
        await trx
          .insertInto('service_translations')
          .values({ id: newId(), service_id: id, locale: translation.locale, ...row })
          .execute();
      }
    }

    await trx.deleteFrom('availability_rules').where('service_id', '=', id).execute();
    if (input.rules.length > 0) {
      await trx
        .insertInto('availability_rules')
        .values(
          input.rules.map((rule) => ({
            id: newId(),
            service_id: id,
            weekday: rule.weekday,
            start_min: rule.startMin,
            end_min: rule.endMin,
            slot_every_min: rule.slotEveryMin,
            is_active: true,
          })),
        )
        .execute();
    }

    return id;
  });
}

/**
 * Archiving a service with upcoming bookings is refused rather than silently
 * stranding customers who hold an appointment.
 */
export async function archiveService(id: string): Promise<void> {
  const upcoming = await db
    .selectFrom('reservations')
    .select((eb) => eb.fn.countAll<number>().as('count'))
    .where('service_id', '=', id)
    .where('starts_at', '>=', new Date())
    .where('status', 'in', ['PENDING', 'CONFIRMED'])
    .executeTakeFirst();

  if (Number(upcoming?.count ?? 0) > 0) {
    throw new AppError('conflict', 'service_has_upcoming_reservations');
  }

  await db
    .updateTable('services')
    .set({ state: 'ARCHIVED', deleted_at: new Date() })
    .where('id', '=', id)
    .execute();
  await db.updateTable('slots').set({ is_blocked: true }).where('service_id', '=', id).execute();
}

export async function listPickupPointOptions() {
  return db
    .selectFrom('pickup_points as p')
    .leftJoin('pickup_point_translations as t', (join) =>
      join.onRef('t.point_id', '=', 'p.id').on('t.locale', '=', 'FR'))
    .select(['p.id', sql<string>`COALESCE(t.name, p.city)`.as('name')])
    .where('p.is_active', '=', true)
    .orderBy('p.position')
    .execute();
}
