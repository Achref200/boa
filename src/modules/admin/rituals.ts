import 'server-only';
import { sql } from 'kysely';
import { db } from '@/db/client';
import { newId } from '@/lib/ids';
import { AppError } from '@/lib/errors';
import type { DbLocale } from '@/i18n/config';

export type AdminRitualRow = {
  id: string;
  slug: string;
  state: string;
  position: number;
  translations: { locale: DbLocale; name: string; intro: string | null }[];
  steps: {
    id: string;
    position: number;
    productId: string | null;
    productName: string | null;
    titles: { locale: DbLocale; title: string; body: string | null }[];
  }[];
};

export async function listRituals(): Promise<AdminRitualRow[]> {
  const rituals = await db
    .selectFrom('rituals')
    .select(['id', 'slug', 'state', 'position'])
    .orderBy('position')
    .execute();

  if (rituals.length === 0) return [];
  const ids = rituals.map((ritual) => ritual.id);

  const [translations, steps] = await Promise.all([
    db
      .selectFrom('ritual_translations')
      .select(['ritual_id as ritualId', 'locale', 'name', 'intro'])
      .where('ritual_id', 'in', ids)
      .execute(),
    db
      .selectFrom('ritual_steps as s')
      .leftJoin('products as p', 'p.id', 's.product_id')
      .leftJoin('product_translations as pt', (join) =>
        join.onRef('pt.product_id', '=', 'p.id').on('pt.locale', '=', 'FR'))
      .select([
        's.id', 's.ritual_id as ritualId', 's.position', 's.product_id as productId',
        sql<string | null>`COALESCE(pt.name, p.slug)`.as('productName'),
      ])
      .where('s.ritual_id', 'in', ids)
      .orderBy('s.position')
      .execute(),
  ]);

  const stepIds = steps.map((step) => step.id);
  const stepTitles =
    stepIds.length > 0
      ? await db
          .selectFrom('ritual_step_translations')
          .select(['step_id as stepId', 'locale', 'title', 'body'])
          .where('step_id', 'in', stepIds)
          .execute()
      : [];

  return rituals.map((ritual) => ({
    ...ritual,
    translations: translations
      .filter((entry) => entry.ritualId === ritual.id)
      .map(({ ritualId: _ritualId, ...rest }) => rest),
    steps: steps
      .filter((step) => step.ritualId === ritual.id)
      .map((step) => ({
        id: step.id,
        position: step.position,
        productId: step.productId,
        productName: step.productName,
        titles: stepTitles
          .filter((title) => title.stepId === step.id)
          .map(({ stepId: _stepId, ...rest }) => rest),
      })),
  }));
}

export type RitualInput = {
  id?: string | undefined;
  slug: string;
  state: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  position: number;
  translations: { locale: DbLocale; name: string; intro: string | null }[];
  steps: {
    productId: string | null;
    titles: { locale: DbLocale; title: string; body: string | null }[];
  }[];
};

/**
 * A ritual's steps are replaced wholesale on save. That is safe here in a way it
 * is not for product variants: nothing historical references a step — an order
 * snapshots the products it contains, not the ritual that suggested them.
 */
export async function saveRitual(input: RitualInput): Promise<string> {
  if (input.steps.length === 0) throw new AppError('validation_failed', 'at_least_one_step');

  return db.transaction().execute(async (trx) => {
    const id = input.id ?? newId();

    const clash = await trx
      .selectFrom('rituals')
      .select('id')
      .where('slug', '=', input.slug)
      .where('id', '!=', id)
      .executeTakeFirst();
    if (clash) throw new AppError('conflict', 'slug_taken');

    const values = { slug: input.slug, state: input.state, position: input.position };
    if (input.id) {
      await trx.updateTable('rituals').set(values).where('id', '=', id).execute();
    } else {
      await trx.insertInto('rituals').values({ id, ...values }).execute();
    }

    for (const translation of input.translations) {
      const existing = await trx
        .selectFrom('ritual_translations')
        .select('id')
        .where('ritual_id', '=', id)
        .where('locale', '=', translation.locale)
        .executeTakeFirst();

      const row = { name: translation.name, intro: translation.intro };
      if (existing) {
        await trx.updateTable('ritual_translations').set(row).where('id', '=', existing.id).execute();
      } else {
        await trx
          .insertInto('ritual_translations')
          .values({ id: newId(), ritual_id: id, locale: translation.locale, ...row })
          .execute();
      }
    }

    await trx.deleteFrom('ritual_steps').where('ritual_id', '=', id).execute();

    let position = 0;
    for (const step of input.steps) {
      const stepId = newId();
      position += 1;
      await trx
        .insertInto('ritual_steps')
        .values({ id: stepId, ritual_id: id, product_id: step.productId, position })
        .execute();

      for (const title of step.titles) {
        if (!title.title.trim()) continue;
        await trx
          .insertInto('ritual_step_translations')
          .values({
            id: newId(),
            step_id: stepId,
            locale: title.locale,
            title: title.title,
            body: title.body,
          })
          .execute();
      }
    }

    return id;
  });
}

export async function archiveRitual(id: string): Promise<void> {
  await db.updateTable('rituals').set({ state: 'ARCHIVED' }).where('id', '=', id).execute();
}
