import 'server-only';
import { db } from '@/db/client';
import { newId } from '@/lib/ids';
import { addDays, businessDateParts, businessTimeToUtc, toIsoDate } from '@/lib/tz';

/**
 * Availability is a *rule set*, not a calendar of rows an admin has to fill in.
 *
 * `availability_rules` describe recurring weekly windows; `availability_exceptions`
 * close a date or open a one-off one. Concrete `slots` are materialised from
 * those rules for a rolling horizon, and the materialised row is what a
 * reservation points at — so changing the rules tomorrow cannot silently move
 * an appointment that already exists.
 *
 * Generation is idempotent: the unique index on (service_id, starts_at) means
 * running it twice, or from two processes, is harmless.
 */
export type SlotView = {
  id: string;
  startsAt: Date;
  endsAt: Date;
  capacity: number;
  taken: number;
  remaining: number;
};

export type DayAvailability = { date: string; slots: SlotView[] };

export async function generateSlots(serviceId: string, horizonDays?: number): Promise<number> {
  const service = await db
    .selectFrom('services')
    .select([
      'id', 'duration_min as durationMin', 'capacity', 'buffer_min as bufferMin',
      'horizon_days as horizonDays', 'state', 'deleted_at as deletedAt',
    ])
    .where('id', '=', serviceId)
    .executeTakeFirst();

  if (!service || service.state !== 'PUBLISHED' || service.deletedAt) return 0;

  const days = horizonDays ?? service.horizonDays;
  const [rules, exceptions] = await Promise.all([
    db
      .selectFrom('availability_rules')
      .select([
        'weekday', 'start_min as startMin', 'end_min as endMin',
        'slot_every_min as slotEveryMin', 'valid_from as validFrom', 'valid_until as validUntil',
      ])
      .where('service_id', '=', serviceId)
      .where('is_active', '=', true)
      .execute(),
    db
      .selectFrom('availability_exceptions')
      .select(['date', 'is_open as isOpen', 'start_min as startMin', 'end_min as endMin'])
      .where('service_id', '=', serviceId)
      .execute(),
  ]);

  if (rules.length === 0) return 0;

  const exceptionByDate = new Map(
    exceptions.map((exception) => [toIsoDate(businessDateParts(exception.date)), exception]),
  );

  const rows: { id: string; service_id: string; starts_at: Date; ends_at: Date; capacity: number }[] = [];
  const now = new Date();

  for (let offset = 0; offset <= days; offset += 1) {
    const day = addDays(now, offset);
    const parts = businessDateParts(day);
    const iso = toIsoDate(parts);
    const exception = exceptionByDate.get(iso);

    // A closure wins outright; a one-off opening replaces the weekly window.
    if (exception && !exception.isOpen) continue;

    const windows =
      exception && exception.isOpen && exception.startMin !== null && exception.endMin !== null
        ? [{ startMin: exception.startMin, endMin: exception.endMin, slotEveryMin: service.durationMin + service.bufferMin }]
        : rules
            .filter((rule) => rule.weekday === parts.weekday)
            .filter((rule) => !rule.validFrom || rule.validFrom <= day)
            .filter((rule) => !rule.validUntil || rule.validUntil >= day)
            .map((rule) => ({
              startMin: rule.startMin,
              endMin: rule.endMin,
              slotEveryMin: rule.slotEveryMin,
            }));

    for (const window of windows) {
      const step = Math.max(15, window.slotEveryMin);
      for (let minute = window.startMin; minute + service.durationMin <= window.endMin; minute += step) {
        const startsAt = businessTimeToUtc(parts.year, parts.month, parts.day, minute);
        if (startsAt.getTime() <= now.getTime()) continue;
        rows.push({
          id: newId(),
          service_id: serviceId,
          starts_at: startsAt,
          // Capacity is copied from the service now, so changing the service
          // later cannot retroactively overbook a slot that already exists.
          ends_at: new Date(startsAt.getTime() + service.durationMin * 60000),
          capacity: service.capacity,
        });
      }
    }
  }

  if (rows.length === 0) return 0;

  // Chunked so a 45-day horizon does not become one enormous statement.
  let inserted = 0;
  for (let index = 0; index < rows.length; index += 200) {
    const chunk = rows.slice(index, index + 200);
    const result = await db.insertInto('slots').ignore().values(chunk).executeTakeFirst();
    inserted += Number(result.numInsertedOrUpdatedRows ?? 0);
  }
  return inserted;
}

/**
 * Availability for the storefront calendar. `remaining` is advisory — the
 * booking transaction is what actually decides, and it can and will refuse a
 * slot this query reported as free a second earlier.
 */
export async function getAvailability(
  serviceId: string,
  options: { from?: Date; days?: number; leadTimeHours?: number } = {},
): Promise<DayAvailability[]> {
  const from = options.from ?? new Date();
  const days = options.days ?? 45;
  const earliest = new Date(from.getTime() + (options.leadTimeHours ?? 0) * 60 * 60 * 1000);
  const until = addDays(from, days);

  const rows = await db
    .selectFrom('slots as s')
    .leftJoin('reservation_seats as seat', 'seat.slot_id', 's.id')
    .select((eb) => [
      's.id', 's.starts_at as startsAt', 's.ends_at as endsAt', 's.capacity',
      eb.fn.count<number>('seat.id').distinct().as('taken'),
    ])
    .where('s.service_id', '=', serviceId)
    .where('s.is_blocked', '=', false)
    .where('s.starts_at', '>=', earliest)
    .where('s.starts_at', '<=', until)
    .groupBy(['s.id', 's.starts_at', 's.ends_at', 's.capacity'])
    .orderBy('s.starts_at')
    .execute();

  const byDate = new Map<string, SlotView[]>();
  for (const row of rows) {
    const taken = Number(row.taken);
    const view: SlotView = {
      id: row.id,
      startsAt: row.startsAt,
      endsAt: row.endsAt,
      capacity: row.capacity,
      taken,
      remaining: Math.max(0, row.capacity - taken),
    };
    const key = toIsoDate(businessDateParts(row.startsAt));
    const list = byDate.get(key) ?? [];
    list.push(view);
    byDate.set(key, list);
  }

  return [...byDate.entries()]
    .map(([date, slots]) => ({ date, slots }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Removes slots that are in the past and were never booked. */
export async function pruneStaleSlots(): Promise<void> {
  await db
    .deleteFrom('slots')
    .where('starts_at', '<', addDays(new Date(), -1))
    .where(({ not, exists, selectFrom }) =>
      not(exists(selectFrom('reservation_seats').select('id').whereRef('reservation_seats.slot_id', '=', 'slots.id'))),
    )
    .execute();
}
