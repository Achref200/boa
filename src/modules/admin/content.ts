import 'server-only';
import { db } from '@/db/client';
import { newId } from '@/lib/ids';
import { parseJson, toJsonColumn } from '@/lib/json';
import type { DbLocale } from '@/i18n/config';

/**
 * Editable site content: the homepage bands, the announcement strip, and the
 * company facts. This is what makes "change the headline" a five-minute job for
 * BOA instead of a developer ticket — and the deliberate boundary is that the
 * *structure* of a band stays in code while its copy, media and visibility are
 * data. A fully generic page builder would be more powerful and much harder for
 * a non-technical administrator to keep coherent.
 */
export type ContentBlockRow = {
  id: string;
  page: string;
  kind: string;
  position: number;
  isVisible: boolean;
  mediaPath: string | null;
  payload: Record<string, unknown>;
  translations: {
    locale: DbLocale;
    eyebrow: string | null;
    heading: string | null;
    body: string | null;
    ctaLabel: string | null;
    ctaHref: string | null;
  }[];
};

export const BLOCK_LABELS: Record<string, string> = {
  hero: 'Ouverture',
  needs: 'Par besoin',
  signature: 'Signatures',
  maison: 'La maison',
  rituals: 'Rituels',
  services: 'Services',
};

export async function listContentBlocks(page = 'home'): Promise<ContentBlockRow[]> {
  const blocks = await db
    .selectFrom('content_blocks')
    .select([
      'id', 'page', 'kind', 'position', 'is_visible as isVisible',
      'media_path as mediaPath', 'payload',
    ])
    .where('page', '=', page)
    .orderBy('position')
    .execute();

  if (blocks.length === 0) return [];

  const translations = await db
    .selectFrom('content_block_translations')
    .select([
      'block_id as blockId', 'locale', 'eyebrow', 'heading', 'body',
      'cta_label as ctaLabel', 'cta_href as ctaHref',
    ])
    .where('block_id', 'in', blocks.map((block) => block.id))
    .execute();

  return blocks.map((block) => ({
    ...block,
    payload: parseJson<Record<string, unknown>>(block.payload, {}),
    translations: translations
      .filter((entry) => entry.blockId === block.id)
      .map(({ blockId: _blockId, ...rest }) => rest),
  }));
}

export async function saveContentBlock(input: {
  id: string;
  isVisible: boolean;
  position: number;
  payload: Record<string, unknown>;
  translations: {
    locale: DbLocale;
    eyebrow: string | null;
    heading: string | null;
    body: string | null;
    ctaLabel: string | null;
    ctaHref: string | null;
  }[];
}): Promise<void> {
  await db.transaction().execute(async (trx) => {
    await trx
      .updateTable('content_blocks')
      .set({
        is_visible: input.isVisible,
        position: input.position,
        payload: toJsonColumn(input.payload),
      })
      .where('id', '=', input.id)
      .execute();

    for (const translation of input.translations) {
      const existing = await trx
        .selectFrom('content_block_translations')
        .select('id')
        .where('block_id', '=', input.id)
        .where('locale', '=', translation.locale)
        .executeTakeFirst();

      const values = {
        eyebrow: translation.eyebrow,
        heading: translation.heading,
        body: translation.body,
        cta_label: translation.ctaLabel,
        cta_href: translation.ctaHref,
      };

      if (existing) {
        await trx.updateTable('content_block_translations').set(values).where('id', '=', existing.id).execute();
      } else {
        await trx
          .insertInto('content_block_translations')
          .values({ id: newId(), block_id: input.id, locale: translation.locale, ...values })
          .execute();
      }
    }
  });
}

export type SettingsMap = Record<string, string>;

export const EDITABLE_SETTINGS: { key: string; label: string; hint?: string; multiline?: boolean }[] = [
  { key: 'contactEmail', label: 'E-mail de contact' },
  { key: 'contactPhone', label: 'Téléphone' },
  { key: 'addressLine', label: 'Adresse' },
  { key: 'city', label: 'Ville' },
  { key: 'openingHours', label: 'Horaires', hint: 'Affichés dans le pied de page et sur la page contact.' },
  { key: 'instagramUrl', label: 'Instagram' },
  { key: 'facebookUrl', label: 'Facebook' },
  { key: 'legalNotice', label: 'Mentions légales', multiline: true },
  { key: 'returnPolicy', label: 'Politique de retour', multiline: true },
];

export async function getSettingsMap(): Promise<SettingsMap> {
  const rows = await db.selectFrom('settings').select(['key', 'value']).execute();
  const map: SettingsMap = {};
  for (const row of rows) {
    const value = parseJson<unknown>(row.value, '');
    if (typeof value === 'string') map[row.key] = value;
  }
  return map;
}

export async function saveSettings(values: SettingsMap): Promise<void> {
  for (const [key, value] of Object.entries(values)) {
    await db
      .insertInto('settings')
      .values({ key, value: toJsonColumn(value) })
      .onDuplicateKeyUpdate({ value: toJsonColumn(value) })
      .execute();
  }
}

export async function listAnnouncements() {
  const rows = await db
    .selectFrom('announcements as a')
    .leftJoin('announcement_translations as t', (join) =>
      join.onRef('t.announcement_id', '=', 'a.id').on('t.locale', '=', 'FR'))
    .select(['a.id', 'a.is_active as isActive', 'a.starts_at as startsAt', 'a.ends_at as endsAt', 't.message'])
    .execute();
  return rows;
}
