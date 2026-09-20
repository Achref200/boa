import 'server-only';
import { sql } from 'kysely';
import { unstable_cache } from 'next/cache';
import { db } from '@/db/client';
import { withBuildFallback } from '@/db/build-guard';
import { dbLocale, DEFAULT_LOCALE, type AppLocale } from '@/i18n/config';
import { CATALOG_TAG } from './service';

export type CategoryView = {
  id: string;
  slug: string;
  name: string;
  intro: string | null;
  imagePath: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  parentSlug: string | null;
  parentName: string | null;
  children: { slug: string; name: string }[];
};

async function fetchCategory(locale: AppLocale, slug: string): Promise<CategoryView | null> {
  const requested = dbLocale(locale);
  const fallback = dbLocale(DEFAULT_LOCALE);

  const row = await db
    .selectFrom('categories as c')
    .leftJoin('category_translations as t', (join) =>
      join.onRef('t.category_id', '=', 'c.id').on('t.locale', '=', requested))
    .leftJoin('category_translations as f', (join) =>
      join.onRef('f.category_id', '=', 'c.id').on('f.locale', '=', fallback))
    .leftJoin('categories as p', 'p.id', 'c.parent_id')
    .leftJoin('category_translations as pt', (join) =>
      join.onRef('pt.category_id', '=', 'p.id').on('pt.locale', '=', requested))
    .where('c.slug', '=', slug)
    .where('c.state', '=', 'PUBLISHED')
    .select([
      'c.id',
      'c.slug',
      'c.image_path as imagePath',
      sql<string>`COALESCE(t.name, f.name, c.slug)`.as('name'),
      sql<string | null>`COALESCE(t.intro, f.intro)`.as('intro'),
      sql<string | null>`COALESCE(t.meta_title, f.meta_title)`.as('metaTitle'),
      sql<string | null>`COALESCE(t.meta_description, f.meta_description)`.as('metaDescription'),
      sql<string | null>`p.slug`.as('parentSlug'),
      sql<string | null>`pt.name`.as('parentName'),
    ])
    .executeTakeFirst();

  if (!row) return null;

  const children = await db
    .selectFrom('categories as c')
    .leftJoin('category_translations as t', (join) =>
      join.onRef('t.category_id', '=', 'c.id').on('t.locale', '=', requested))
    .leftJoin('category_translations as f', (join) =>
      join.onRef('f.category_id', '=', 'c.id').on('f.locale', '=', fallback))
    .where('c.parent_id', '=', row.id)
    .where('c.state', '=', 'PUBLISHED')
    .select(['c.slug', sql<string>`COALESCE(t.name, f.name, c.slug)`.as('name')])
    .orderBy('c.position')
    .execute();

  return { ...row, children };
}

export const getCategory = (locale: AppLocale, slug: string) =>
  unstable_cache(() => fetchCategory(locale, slug), ['category', locale, slug], {
    tags: [CATALOG_TAG],
    revalidate: 3600,
  })();

/**
 * Descendant slugs, so "Cheveux" lists everything under it rather than only the
 * products pinned directly to the parent. The tree is two levels deep by
 * design; if BOA ever needs more, this is the one place that changes.
 */
export async function categoryBranchSlugs(locale: AppLocale, slug: string): Promise<string[]> {
  const category = await getCategory(locale, slug);
  if (!category) return [];
  return [category.slug, ...category.children.map((child) => child.slug)];
}

export const getPublishedCategorySlugs = () =>
  unstable_cache(
    () =>
      withBuildFallback([], () =>
        db
          .selectFrom('categories')
          .select(['slug', 'updated_at as updatedAt'])
          .where('state', '=', 'PUBLISHED')
          .execute(),
      ),
    ['category-slugs'],
    { tags: [CATALOG_TAG], revalidate: 3600 },
  )();
