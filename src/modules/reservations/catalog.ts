import 'server-only';
import { sql } from 'kysely';
import { unstable_cache } from 'next/cache';
import { db } from '@/db/client';
import { withBuildFallback } from '@/db/build-guard';
import { dbLocale, DEFAULT_LOCALE, type AppLocale } from '@/i18n/config';
import type { MoneyString } from '@/lib/money';

export const SERVICES_TAG = 'services';

export type ServiceView = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  description: string | null;
  preparation: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  durationMin: number;
  capacity: number;
  price: MoneyString | null;
  depositAmount: MoneyString | null;
  leadTimeHours: number;
  horizonDays: number;
  coverPath: string | null;
  locationName: string | null;
  locationAddress: string | null;
};

async function fetchServices(locale: AppLocale, slug?: string): Promise<ServiceView[]> {
  const requested = dbLocale(locale);
  const fallback = dbLocale(DEFAULT_LOCALE);

  let query = db
    .selectFrom('services as s')
    .leftJoin('service_translations as t', (join) =>
      join.onRef('t.service_id', '=', 's.id').on('t.locale', '=', requested))
    .leftJoin('service_translations as f', (join) =>
      join.onRef('f.service_id', '=', 's.id').on('f.locale', '=', fallback))
    .leftJoin('pickup_points as pp', 'pp.id', 's.location_id')
    .leftJoin('pickup_point_translations as ppt', (join) =>
      join.onRef('ppt.point_id', '=', 'pp.id').on('ppt.locale', '=', requested))
    .where('s.state', '=', 'PUBLISHED')
    .where('s.deleted_at', 'is', null);

  if (slug) query = query.where('s.slug', '=', slug);

  return query
    .select([
      's.id', 's.slug',
      's.duration_min as durationMin', 's.capacity', 's.price',
      's.deposit_amount as depositAmount',
      's.lead_time_hours as leadTimeHours', 's.horizon_days as horizonDays',
      's.cover_path as coverPath',
      sql<string>`COALESCE(t.name, f.name, s.slug)`.as('name'),
      sql<string | null>`COALESCE(t.tagline, f.tagline)`.as('tagline'),
      sql<string | null>`COALESCE(t.description, f.description)`.as('description'),
      sql<string | null>`COALESCE(t.preparation, f.preparation)`.as('preparation'),
      sql<string | null>`COALESCE(t.meta_title, f.meta_title)`.as('metaTitle'),
      sql<string | null>`COALESCE(t.meta_description, f.meta_description)`.as('metaDescription'),
      sql<string | null>`ppt.name`.as('locationName'),
      sql<string | null>`CONCAT_WS(', ', pp.address_line, pp.city)`.as('locationAddress'),
    ])
    .orderBy('s.position')
    .execute();
}

export const getServices = (locale: AppLocale) =>
  unstable_cache(() => withBuildFallback([], () => fetchServices(locale)), ['services', locale], {
    tags: [SERVICES_TAG],
    revalidate: 900,
  })();

export const getService = async (locale: AppLocale, slug: string): Promise<ServiceView | null> => {
  const rows = await unstable_cache(
    () => withBuildFallback([], () => fetchServices(locale, slug)),
    ['service', locale, slug],
    {
      tags: [SERVICES_TAG],
      revalidate: 900,
    },
  )();
  return rows[0] ?? null;
};
