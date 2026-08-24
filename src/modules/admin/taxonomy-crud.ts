import 'server-only';
import { sql, type Transaction } from 'kysely';
import { db } from '@/db/client';
import type { Database } from '@/db/types';
import { newId } from '@/lib/ids';
import { AppError } from '@/lib/errors';
import type { DbLocale } from '@/i18n/config';

/**
 * Categories, needs and collections are the same shape: a slug, a position, a
 * publish state and one row of copy per locale. Rather than three near-identical
 * modules that drift apart, they share one implementation parameterised by
 * table name — the small amount of dynamic SQL here is confined to a closed set
 * of literals defined below, never to anything a request can influence.
 */
type TaxonomyKind = 'categories' | 'needs' | 'collections';

const TABLES = {
  categories: { translations: 'category_translations', fk: 'category_id', hasIntro: true, hasParent: true },
  needs: { translations: 'need_translations', fk: 'need_id', hasIntro: false, hasParent: false },
  collections: { translations: 'collection_translations', fk: 'collection_id', hasIntro: true, hasParent: false },
} as const;

export type TaxonomyRow = {
  id: string;
  slug: string;
  position: number;
  state: string;
  parentId: string | null;
  usageCount: number;
  translations: { locale: DbLocale; name: string; intro: string | null }[];
};

export async function listTaxonomy(kind: TaxonomyKind): Promise<TaxonomyRow[]> {
  const meta = TABLES[kind];

  const rows =
    kind === 'categories'
      ? await db
          .selectFrom('categories as e')
          .select((eb) => [
            'e.id', 'e.slug', 'e.position', 'e.state', 'e.parent_id as parentId',
            eb.selectFrom('products')
              .select(({ fn }) => fn.countAll<number>().as('count'))
              .whereRef('products.category_id', '=', 'e.id')
              .where('products.deleted_at', 'is', null)
              .as('usageCount'),
          ])
          .orderBy('e.position')
          .execute()
      : kind === 'needs'
        ? await db
            .selectFrom('needs as e')
            .select((eb) => [
              'e.id', 'e.slug', 'e.position', 'e.state',
              sql<string | null>`NULL`.as('parentId'),
              eb.selectFrom('product_needs')
                .select(({ fn }) => fn.countAll<number>().as('count'))
                .whereRef('product_needs.need_id', '=', 'e.id')
                .as('usageCount'),
            ])
            .orderBy('e.position')
            .execute()
        : await db
            .selectFrom('collections as e')
            .select((eb) => [
              'e.id', 'e.slug', 'e.position', 'e.state',
              sql<string | null>`NULL`.as('parentId'),
              eb.selectFrom('collection_products')
                .select(({ fn }) => fn.countAll<number>().as('count'))
                .whereRef('collection_products.collection_id', '=', 'e.id')
                .as('usageCount'),
            ])
            .orderBy('e.position')
            .execute();

  if (rows.length === 0) return [];

  const ids = rows.map((row) => row.id);
  const translations = await sql<{
    entityId: string;
    locale: DbLocale;
    name: string;
    intro: string | null;
  }>`
    SELECT ${sql.ref(meta.fk)} AS entityId, locale, name,
           ${meta.hasIntro ? sql.ref('intro') : sql`NULL`} AS intro
    FROM ${sql.table(meta.translations)}
    WHERE ${sql.ref(meta.fk)} IN (${sql.join(ids)})
  `.execute(db);

  return rows.map((row) => ({
    ...row,
    usageCount: Number(row.usageCount ?? 0),
    translations: translations.rows
      .filter((entry) => entry.entityId === row.id)
      .map(({ entityId: _entityId, ...rest }) => rest),
  }));
}

export type TaxonomyInput = {
  id?: string | undefined;
  slug: string;
  position: number;
  state: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  parentId?: string | null;
  translations: { locale: DbLocale; name: string; intro: string | null }[];
};

export async function saveTaxonomy(kind: TaxonomyKind, input: TaxonomyInput): Promise<string> {
  const meta = TABLES[kind];

  return db.transaction().execute(async (trx) => {
    const id = input.id ?? newId();

    const clash = await sql<{ id: string }>`
      SELECT id FROM ${sql.table(kind)} WHERE slug = ${input.slug} AND id <> ${id} LIMIT 1
    `.execute(trx);
    if (clash.rows.length > 0) throw new AppError('conflict', 'slug_taken');

    if (kind === 'categories' && input.parentId === id) {
      throw new AppError('validation_failed', 'category_cannot_parent_itself');
    }

    if (input.id) {
      await updateEntity(trx, kind, id, input);
    } else {
      await insertEntity(trx, kind, id, input);
    }

    for (const translation of input.translations) {
      const existing = await sql<{ id: string }>`
        SELECT id FROM ${sql.table(meta.translations)}
        WHERE ${sql.ref(meta.fk)} = ${id} AND locale = ${translation.locale} LIMIT 1
      `.execute(trx);

      if (existing.rows.length > 0) {
        if (meta.hasIntro) {
          await sql`
            UPDATE ${sql.table(meta.translations)}
            SET name = ${translation.name}, intro = ${translation.intro}
            WHERE id = ${existing.rows[0]!.id}
          `.execute(trx);
        } else {
          await sql`
            UPDATE ${sql.table(meta.translations)}
            SET name = ${translation.name}
            WHERE id = ${existing.rows[0]!.id}
          `.execute(trx);
        }
      } else if (meta.hasIntro) {
        await sql`
          INSERT INTO ${sql.table(meta.translations)} (id, ${sql.ref(meta.fk)}, locale, name, intro)
          VALUES (${newId()}, ${id}, ${translation.locale}, ${translation.name}, ${translation.intro})
        `.execute(trx);
      } else {
        await sql`
          INSERT INTO ${sql.table(meta.translations)} (id, ${sql.ref(meta.fk)}, locale, name)
          VALUES (${newId()}, ${id}, ${translation.locale}, ${translation.name})
        `.execute(trx);
      }
    }

    return id;
  });
}

async function insertEntity(
  trx: Transaction<Database>,
  kind: TaxonomyKind,
  id: string,
  input: TaxonomyInput,
) {
  if (kind === 'categories') {
    await trx
      .insertInto('categories')
      .values({ id, slug: input.slug, position: input.position, state: input.state, parent_id: input.parentId ?? null })
      .execute();
    return;
  }
  if (kind === 'needs') {
    await trx.insertInto('needs').values({ id, slug: input.slug, position: input.position, state: input.state }).execute();
    return;
  }
  await trx
    .insertInto('collections')
    .values({ id, slug: input.slug, position: input.position, state: input.state })
    .execute();
}

async function updateEntity(
  trx: Transaction<Database>,
  kind: TaxonomyKind,
  id: string,
  input: TaxonomyInput,
) {
  if (kind === 'categories') {
    await trx
      .updateTable('categories')
      .set({ slug: input.slug, position: input.position, state: input.state, parent_id: input.parentId ?? null })
      .where('id', '=', id)
      .execute();
    return;
  }
  if (kind === 'needs') {
    await trx
      .updateTable('needs')
      .set({ slug: input.slug, position: input.position, state: input.state })
      .where('id', '=', id)
      .execute();
    return;
  }
  await trx
    .updateTable('collections')
    .set({ slug: input.slug, position: input.position, state: input.state })
    .where('id', '=', id)
    .execute();
}

/**
 * Archive, not delete. A category with products behind it would leave those
 * products orphaned; archiving hides it from the storefront and leaves the
 * relationship intact so nothing silently loses its shelf.
 */
export async function archiveTaxonomy(kind: TaxonomyKind, id: string): Promise<void> {
  await sql`UPDATE ${sql.table(kind)} SET state = 'ARCHIVED' WHERE id = ${id}`.execute(db);
}
