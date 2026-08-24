import 'server-only';
import { unstable_cache } from 'next/cache';
import { sql } from 'kysely';
import { db } from '@/db/client';
import { dbLocale, DEFAULT_LOCALE, type AppLocale } from '@/i18n/config';
import { parseJson } from '@/lib/json';

export const CONTENT_TAG = 'content';

export type Announcement = { message: string; href: string | null } | null;

export type ContentBlock = {
  id: string;
  kind: string;
  mediaPath: string | null;
  payload: Record<string, unknown>;
  eyebrow: string | null;
  heading: string | null;
  body: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
};

async function fetchAnnouncement(locale: AppLocale): Promise<Announcement> {
  const now = new Date();
  const row = await db
    .selectFrom('announcements as a')
    .innerJoin('announcement_translations as t', (join) =>
      join.onRef('t.announcement_id', '=', 'a.id').on('t.locale', '=', dbLocale(locale)),
    )
    .where('a.is_active', '=', true)
    .where((eb) => eb.or([eb('a.starts_at', 'is', null), eb('a.starts_at', '<=', now)]))
    .where((eb) => eb.or([eb('a.ends_at', 'is', null), eb('a.ends_at', '>=', now)]))
    .select(['t.message', 't.href'])
    .limit(1)
    .executeTakeFirst();
  return row ?? null;
}

async function fetchBlocks(locale: AppLocale, page: string): Promise<ContentBlock[]> {
  const requested = dbLocale(locale);
  const fallback = dbLocale(DEFAULT_LOCALE);

  const rows = await db
    .selectFrom('content_blocks as b')
    .leftJoin('content_block_translations as t', (join) =>
      join.onRef('t.block_id', '=', 'b.id').on('t.locale', '=', requested),
    )
    .leftJoin('content_block_translations as f', (join) =>
      join.onRef('f.block_id', '=', 'b.id').on('f.locale', '=', fallback),
    )
    .where('b.page', '=', page)
    .where('b.is_visible', '=', true)
    .select([
      'b.id',
      'b.kind',
      'b.payload',
      'b.media_path as mediaPath',
      sql<string | null>`COALESCE(t.eyebrow, f.eyebrow)`.as('eyebrow'),
      sql<string | null>`COALESCE(t.heading, f.heading)`.as('heading'),
      sql<string | null>`COALESCE(t.body, f.body)`.as('body'),
      sql<string | null>`COALESCE(t.cta_label, f.cta_label)`.as('ctaLabel'),
      sql<string | null>`COALESCE(t.cta_href, f.cta_href)`.as('ctaHref'),
    ])
    .orderBy('b.position')
    .execute();

  return rows.map((row) => ({
    ...row,
    payload: parseJson<Record<string, unknown>>(row.payload, {}),
  }));
}

export const getActiveAnnouncement = (locale: AppLocale) =>
  unstable_cache(() => fetchAnnouncement(locale), ['announcement', locale], {
    tags: [CONTENT_TAG],
    revalidate: 300,
  })();

export const getPageBlocks = (locale: AppLocale, page = 'home') =>
  unstable_cache(() => fetchBlocks(locale, page), ['blocks', locale, page], {
    tags: [CONTENT_TAG],
    revalidate: 300,
  })();

/**
 * Company facts (address, phone, hours, policies) live in `settings` so a
 * non-technical admin can fill them in. Anything unset renders as absent rather
 * than as a plausible-looking invention.
 */
export type SiteSettings = {
  contactEmail: string | null;
  contactPhone: string | null;
  addressLine: string | null;
  city: string | null;
  openingHours: string | null;
  instagramUrl: string | null;
  facebookUrl: string | null;
  legalNotice: string | null;
  returnPolicy: string | null;
};

const EMPTY_SETTINGS: SiteSettings = {
  contactEmail: null,
  contactPhone: null,
  addressLine: null,
  city: null,
  openingHours: null,
  instagramUrl: null,
  facebookUrl: null,
  legalNotice: null,
  returnPolicy: null,
};

async function fetchSettings(): Promise<SiteSettings> {
  const rows = await db.selectFrom('settings').select(['key', 'value']).execute();
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const read = (key: keyof SiteSettings): string | null => {
    const value = parseJson<unknown>(map.get(key), null);
    if (typeof value === 'string') return value.trim() === '' ? null : value;
    return null;
  };
  return {
    contactEmail: read('contactEmail'),
    contactPhone: read('contactPhone'),
    addressLine: read('addressLine'),
    city: read('city'),
    openingHours: read('openingHours'),
    instagramUrl: read('instagramUrl'),
    facebookUrl: read('facebookUrl'),
    legalNotice: read('legalNotice'),
    returnPolicy: read('returnPolicy'),
  };
}

export const getSiteSettings = () =>
  unstable_cache(fetchSettings, ['site-settings'], { tags: [CONTENT_TAG], revalidate: 600 })()
    .catch(() => EMPTY_SETTINGS);
