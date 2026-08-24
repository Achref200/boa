import 'server-only';
import { sql } from 'kysely';
import { db } from '@/db/client';
import { dbLocale, DEFAULT_LOCALE, type AppLocale } from '@/i18n/config';
import type {
  CategoryNode,
  MediaRef,
  Navigation,
  NeedView,
  Paginated,
  ProductCard,
  ProductDetail,
  ProductQuery,
} from './types';

const PER_PAGE_DEFAULT = 24;
const PER_PAGE_MAX = 60;

/**
 * Translation fallback: a row missing a translation in the requested locale
 * falls back to French rather than disappearing from the catalogue. Admins can
 * therefore publish a product before every language is written.
 */
function translationJoin(locale: AppLocale) {
  return { requested: dbLocale(locale), fallback: dbLocale(DEFAULT_LOCALE) };
}

export async function fetchNavigation(locale: AppLocale): Promise<Navigation> {
  const { requested, fallback } = translationJoin(locale);

  const rows = await db
    .selectFrom('categories as c')
    .leftJoin('category_translations as t', (join) =>
      join.onRef('t.category_id', '=', 'c.id').on('t.locale', '=', requested),
    )
    .leftJoin('category_translations as f', (join) =>
      join.onRef('f.category_id', '=', 'c.id').on('f.locale', '=', fallback),
    )
    .where('c.state', '=', 'PUBLISHED')
    .select([
      'c.id',
      'c.slug',
      'c.parent_id',
      'c.position',
      sql<string>`COALESCE(t.name, f.name, c.slug)`.as('name'),
      sql<string | null>`COALESCE(t.intro, f.intro)`.as('intro'),
    ])
    .orderBy('c.position')
    .execute();

  const byParent = new Map<string | null, typeof rows>();
  for (const row of rows) {
    const list = byParent.get(row.parent_id) ?? [];
    list.push(row);
    byParent.set(row.parent_id, list);
  }

  const build = (parentId: string | null): CategoryNode[] =>
    (byParent.get(parentId) ?? []).map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      intro: row.intro,
      children: build(row.id),
    }));

  const needs = await fetchNeeds(locale);
  return { categories: build(null), needs };
}

export async function fetchNeeds(locale: AppLocale): Promise<NeedView[]> {
  const { requested, fallback } = translationJoin(locale);
  const rows = await db
    .selectFrom('needs as n')
    .leftJoin('need_translations as t', (join) =>
      join.onRef('t.need_id', '=', 'n.id').on('t.locale', '=', requested),
    )
    .leftJoin('need_translations as f', (join) =>
      join.onRef('f.need_id', '=', 'n.id').on('f.locale', '=', fallback),
    )
    .where('n.state', '=', 'PUBLISHED')
    .select([
      'n.id',
      'n.slug',
      sql<string>`COALESCE(t.name, f.name, n.slug)`.as('name'),
      sql<string | null>`COALESCE(t.tagline, f.tagline)`.as('tagline'),
    ])
    .orderBy('n.position')
    .execute();
  return rows;
}

/** One query for the page of products, one for their images. Never N+1. */
async function attachMedia(cards: Omit<ProductCard, 'image'>[]): Promise<ProductCard[]> {
  if (cards.length === 0) return [];
  const ids = cards.map((c) => c.id);

  const media = await db
    .selectFrom('product_media')
    .select(['product_id', 'path', 'alt', 'width', 'height', 'position'])
    .where('product_id', 'in', ids)
    .where('kind', '=', 'IMAGE')
    .orderBy('product_id')
    .orderBy('position')
    .execute();

  const first = new Map<string, MediaRef>();
  for (const row of media) {
    if (!first.has(row.product_id)) {
      first.set(row.product_id, {
        path: row.path,
        alt: row.alt,
        width: row.width,
        height: row.height,
      });
    }
  }

  return cards.map((card) => ({ ...card, image: first.get(card.id) ?? null }));
}

export async function fetchProducts(
  locale: AppLocale,
  query: ProductQuery,
): Promise<Paginated<ProductCard>> {
  const { requested, fallback } = translationJoin(locale);
  const page = Math.max(1, Math.trunc(query.page ?? 1));
  const perPage = Math.min(PER_PAGE_MAX, Math.max(1, Math.trunc(query.perPage ?? PER_PAGE_DEFAULT)));

  // Price and stock are aggregated from active variants only, so a product
  // whose only active format is sold out reads as sold out.
  let base = db
    .selectFrom('products as p')
    .innerJoin('product_variants as v', (join) =>
      join.onRef('v.product_id', '=', 'p.id').on('v.is_active', '=', true),
    )
    .leftJoin('categories as c', 'c.id', 'p.category_id')
    .where('p.state', '=', 'PUBLISHED')
    .where('p.deleted_at', 'is', null);

  if (!query.includeProfessional) base = base.where('p.is_professional', '=', false);

  const categorySlugs = query.categorySlugs?.filter(Boolean) ?? [];
  if (categorySlugs.length > 0) base = base.where('c.slug', 'in', categorySlugs);

  if (query.collectionSlug) {
    base = base
      .innerJoin('collection_products as cp', 'cp.product_id', 'p.id')
      .innerJoin('collections as col', (join) =>
        join.onRef('col.id', '=', 'cp.collection_id').on('col.state', '=', 'PUBLISHED'),
      )
      .where('col.slug', '=', query.collectionSlug);
  }

  const needSlugs = query.needSlugs?.filter(Boolean) ?? [];
  if (needSlugs.length > 0) {
    // A product must carry every selected need, not just one: filters narrow.
    base = base
      .innerJoin('product_needs as pn', 'pn.product_id', 'p.id')
      .innerJoin('needs as n', 'n.id', 'pn.need_id')
      .where('n.slug', 'in', needSlugs);
  }

  if (query.inStockOnly) base = base.where('v.stock', '>', 0);

  if (query.search) {
    const term = query.search.trim();
    if (term.length > 1) {
      base = base
        .innerJoin('product_translations as st', 'st.product_id', 'p.id')
        .where(
          sql<boolean>`MATCH(st.name, st.tagline, st.description) AGAINST (${term} IN NATURAL LANGUAGE MODE)`,
        );
    }
  }

  const grouped = base.groupBy('p.id');
  const havingNeeds =
    needSlugs.length > 0
      ? grouped.having(sql<boolean>`COUNT(DISTINCT n.id) = ${needSlugs.length}`)
      : grouped;

  let filtered = havingNeeds;
  if (query.minPrice) filtered = filtered.having(sql<boolean>`MIN(v.price) >= ${query.minPrice}`);
  if (query.maxPrice) filtered = filtered.having(sql<boolean>`MIN(v.price) <= ${query.maxPrice}`);

  const countRows = await filtered.select(sql<number>`1`.as('one')).execute();
  const total = countRows.length;

  const order = (() => {
    switch (query.sort) {
      case 'price_asc': return sql`MIN(v.price) ASC`;
      case 'price_desc': return sql`MIN(v.price) DESC`;
      case 'newest': return sql`p.published_at DESC, p.created_at DESC`;
      default: return sql`p.is_featured DESC, p.position ASC, p.created_at DESC`;
    }
  })();

  const rows = await filtered
    .leftJoin('product_translations as t', (join) =>
      join.onRef('t.product_id', '=', 'p.id').on('t.locale', '=', requested),
    )
    .leftJoin('product_translations as ft', (join) =>
      join.onRef('ft.product_id', '=', 'p.id').on('ft.locale', '=', fallback),
    )
    .select([
      'p.id',
      'p.slug',
      'p.is_professional as isProfessional',
      'c.slug as categorySlug',
      sql<string>`COALESCE(t.name, ft.name, p.slug)`.as('name'),
      sql<string | null>`COALESCE(t.tagline, ft.tagline)`.as('tagline'),
      sql<string>`MIN(v.price)`.as('priceFrom'),
      sql<string | null>`MAX(v.compare_at_price)`.as('compareAtFrom'),
      sql<number>`COUNT(DISTINCT v.id)`.as('formatCount'),
      sql<number>`MAX(CASE WHEN v.stock > 0 OR v.allow_backorder = 1 THEN 1 ELSE 0 END)`.as('inStockFlag'),
    ])
    .orderBy(order)
    .limit(perPage)
    .offset((page - 1) * perPage)
    .execute();

  const cards = rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    tagline: row.tagline,
    categorySlug: row.categorySlug,
    priceFrom: row.priceFrom,
    compareAtFrom: row.compareAtFrom,
    formatCount: Number(row.formatCount),
    inStock: Number(row.inStockFlag) === 1,
    isProfessional: row.isProfessional,
  }));

  return {
    items: await attachMedia(cards),
    total,
    page,
    perPage,
    pageCount: Math.max(1, Math.ceil(total / perPage)),
  };
}

export async function fetchProductBySlug(
  locale: AppLocale,
  slug: string,
): Promise<ProductDetail | null> {
  const { requested, fallback } = translationJoin(locale);

  const product = await db
    .selectFrom('products as p')
    .leftJoin('categories as c', 'c.id', 'p.category_id')
    .leftJoin('category_translations as ct', (join) =>
      join.onRef('ct.category_id', '=', 'c.id').on('ct.locale', '=', requested),
    )
    .leftJoin('product_translations as t', (join) =>
      join.onRef('t.product_id', '=', 'p.id').on('t.locale', '=', requested),
    )
    .leftJoin('product_translations as ft', (join) =>
      join.onRef('ft.product_id', '=', 'p.id').on('ft.locale', '=', fallback),
    )
    .where('p.slug', '=', slug)
    .where('p.state', '=', 'PUBLISHED')
    .where('p.deleted_at', 'is', null)
    .select([
      'p.id',
      'p.slug',
      'p.reference',
      'p.is_professional as isProfessional',
      'p.updated_at as updatedAt',
      'c.slug as categorySlug',
      sql<string | null>`ct.name`.as('categoryName'),
      sql<string>`COALESCE(t.name, ft.name, p.slug)`.as('name'),
      sql<string | null>`COALESCE(t.tagline, ft.tagline)`.as('tagline'),
      sql<string | null>`COALESCE(t.description, ft.description)`.as('description'),
      sql<string | null>`COALESCE(t.usage_notes, ft.usage_notes)`.as('usage'),
      sql<string | null>`COALESCE(t.composition, ft.composition)`.as('composition'),
      sql<string | null>`COALESCE(t.precautions, ft.precautions)`.as('precautions'),
      sql<string | null>`COALESCE(t.storage, ft.storage)`.as('storage'),
      sql<string | null>`COALESCE(t.meta_title, ft.meta_title)`.as('metaTitle'),
      sql<string | null>`COALESCE(t.meta_description, ft.meta_description)`.as('metaDescription'),
    ])
    .executeTakeFirst();

  if (!product) return null;

  const [variants, media, needs] = await Promise.all([
    db
      .selectFrom('product_variants')
      .select([
        'id',
        'sku',
        'format',
        'price',
        'compare_at_price as compareAtPrice',
        'stock',
        'low_stock_at as lowStockAt',
        'allow_backorder as allowBackorder',
        'is_active as isActive',
      ])
      .where('product_id', '=', product.id)
      .where('is_active', '=', true)
      .orderBy('position')
      .execute(),
    db
      .selectFrom('product_media')
      .select(['path', 'alt', 'width', 'height'])
      .where('product_id', '=', product.id)
      .orderBy('position')
      .execute(),
    db
      .selectFrom('product_needs as pn')
      .innerJoin('needs as n', 'n.id', 'pn.need_id')
      .leftJoin('need_translations as nt', (join) =>
        join.onRef('nt.need_id', '=', 'n.id').on('nt.locale', '=', requested),
      )
      .leftJoin('need_translations as nf', (join) =>
        join.onRef('nf.need_id', '=', 'n.id').on('nf.locale', '=', fallback),
      )
      .where('pn.product_id', '=', product.id)
      .where('n.state', '=', 'PUBLISHED')
      .select(['n.slug', sql<string>`COALESCE(nt.name, nf.name, n.slug)`.as('name')])
      .orderBy('n.position')
      .execute(),
  ]);

  const prices = variants.map((v) => v.price);
  const inStock = variants.some((v) => v.stock > 0 || v.allowBackorder);

  return {
    ...product,
    categoryName: product.categoryName,
    priceFrom: prices.length > 0 ? prices.reduce((a, b) => (Number(a) <= Number(b) ? a : b)) : '0.000',
    compareAtFrom: variants.find((v) => v.compareAtPrice)?.compareAtPrice ?? null,
    formatCount: variants.length,
    inStock,
    variants,
    media,
    needs,
    image: media[0] ?? null,
  };
}

export async function fetchRelatedProducts(
  locale: AppLocale,
  productId: string,
  limit = 4,
): Promise<ProductCard[]> {
  const { requested, fallback } = translationJoin(locale);

  const rows = await db
    .selectFrom('product_relations as r')
    .innerJoin('products as p', (join) =>
      join
        .onRef('p.id', '=', 'r.target_id')
        .on('p.state', '=', 'PUBLISHED')
        .on('p.deleted_at', 'is', null),
    )
    .innerJoin('product_variants as v', (join) =>
      join.onRef('v.product_id', '=', 'p.id').on('v.is_active', '=', true),
    )
    .leftJoin('categories as c', 'c.id', 'p.category_id')
    .leftJoin('product_translations as t', (join) =>
      join.onRef('t.product_id', '=', 'p.id').on('t.locale', '=', requested),
    )
    .leftJoin('product_translations as ft', (join) =>
      join.onRef('ft.product_id', '=', 'p.id').on('ft.locale', '=', fallback),
    )
    .where('r.source_id', '=', productId)
    .groupBy('p.id')
    .select([
      'p.id',
      'p.slug',
      'p.is_professional as isProfessional',
      'c.slug as categorySlug',
      sql<string>`COALESCE(t.name, ft.name, p.slug)`.as('name'),
      sql<string | null>`COALESCE(t.tagline, ft.tagline)`.as('tagline'),
      sql<string>`MIN(v.price)`.as('priceFrom'),
      sql<string | null>`MAX(v.compare_at_price)`.as('compareAtFrom'),
      sql<number>`COUNT(DISTINCT v.id)`.as('formatCount'),
      sql<number>`MAX(CASE WHEN v.stock > 0 OR v.allow_backorder = 1 THEN 1 ELSE 0 END)`.as('inStockFlag'),
      sql<number>`MIN(r.position)`.as('relPosition'),
    ])
    .orderBy('relPosition')
    .limit(limit)
    .execute();

  return attachMedia(
    rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      tagline: row.tagline,
      categorySlug: row.categorySlug,
      priceFrom: row.priceFrom,
      compareAtFrom: row.compareAtFrom,
      formatCount: Number(row.formatCount),
      inStock: Number(row.inStockFlag) === 1,
      isProfessional: row.isProfessional,
    })),
  );
}

export async function fetchPublishedProductSlugs(): Promise<{ slug: string; updatedAt: Date }[]> {
  return db
    .selectFrom('products')
    .select(['slug', 'updated_at as updatedAt'])
    .where('state', '=', 'PUBLISHED')
    .where('deleted_at', 'is', null)
    .orderBy('updated_at', 'desc')
    .limit(5000)
    .execute();
}
