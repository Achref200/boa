import 'server-only';
import { sql } from 'kysely';
import { db } from '@/db/client';
import { newId } from '@/lib/ids';
import { AppError } from '@/lib/errors';
import type { DbLocale } from '@/i18n/config';

/**
 * Admin-side catalogue queries.
 *
 * Two rules run through all of them:
 *   • every list is paginated with an explicit `limit` — `findMany` without a
 *     bound is how an admin screen dies at ten thousand products;
 *   • list queries select only the columns the table renders, so opening
 *     "Produits" never loads five description fields per row.
 */
export type AdminProductRow = {
  id: string;
  slug: string;
  reference: string | null;
  name: string;
  state: string;
  isFeatured: boolean;
  isProfessional: boolean;
  categoryName: string | null;
  variantCount: number;
  minPrice: string | null;
  totalStock: number;
  updatedAt: Date;
};

export type AdminProductQuery = {
  search?: string | undefined;
  state?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' | undefined;
  categoryId?: string | undefined;
  page?: number | undefined;
  perPage?: number | undefined;
};

export async function listProducts(query: AdminProductQuery) {
  const page = Math.max(1, query.page ?? 1);
  const perPage = Math.min(100, query.perPage ?? 25);

  let base = db
    .selectFrom('products as p')
    .leftJoin('product_translations as t', (join) =>
      join.onRef('t.product_id', '=', 'p.id').on('t.locale', '=', 'FR'))
    .leftJoin('categories as c', 'c.id', 'p.category_id')
    .leftJoin('category_translations as ct', (join) =>
      join.onRef('ct.category_id', '=', 'c.id').on('ct.locale', '=', 'FR'))
    .where('p.deleted_at', 'is', null);

  if (query.state) base = base.where('p.state', '=', query.state);
  if (query.categoryId) base = base.where('p.category_id', '=', query.categoryId);

  if (query.search) {
    const term = `%${query.search.trim().slice(0, 60)}%`;
    base = base.where((eb) =>
      eb.or([eb('t.name', 'like', term), eb('p.slug', 'like', term), eb('p.reference', 'like', term)]),
    );
  }

  const [rows, total] = await Promise.all([
    base
      .leftJoin('product_variants as v', 'v.product_id', 'p.id')
      .select([
        'p.id', 'p.slug', 'p.reference', 'p.state',
        'p.is_featured as isFeatured', 'p.is_professional as isProfessional',
        'p.updated_at as updatedAt',
        sql<string>`COALESCE(t.name, p.slug)`.as('name'),
        sql<string | null>`ct.name`.as('categoryName'),
        sql<number>`COUNT(DISTINCT v.id)`.as('variantCount'),
        sql<string | null>`MIN(v.price)`.as('minPrice'),
        sql<number>`COALESCE(SUM(v.stock), 0)`.as('totalStock'),
      ])
      .groupBy(['p.id', 't.name', 'ct.name'])
      .orderBy('p.updated_at', 'desc')
      .limit(perPage)
      .offset((page - 1) * perPage)
      .execute(),
    base.select((eb) => eb.fn.count<number>('p.id').distinct().as('count')).executeTakeFirst(),
  ]);

  return {
    rows: rows.map((row) => ({ ...row, variantCount: Number(row.variantCount), totalStock: Number(row.totalStock) })),
    total: Number(total?.count ?? 0),
    page,
    perPage,
    pageCount: Math.max(1, Math.ceil(Number(total?.count ?? 0) / perPage)),
  };
}

export type ProductTranslationInput = {
  locale: DbLocale;
  name: string;
  tagline: string | null;
  description: string | null;
  usage: string | null;
  composition: string | null;
  precautions: string | null;
  storage: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
};

export type ProductVariantInput = {
  id?: string | undefined;
  sku: string;
  format: string;
  price: string;
  compareAtPrice: string | null;
  stock: number;
  lowStockAt: number;
  allowBackorder: boolean;
  isActive: boolean;
  position: number;
};

export type ProductInput = {
  id?: string | undefined;
  slug: string;
  reference: string | null;
  categoryId: string | null;
  state: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  isFeatured: boolean;
  isProfessional: boolean;
  position: number;
  needIds: string[];
  translations: ProductTranslationInput[];
  variants: ProductVariantInput[];
};

export async function getProductForEdit(id: string) {
  const product = await db
    .selectFrom('products')
    .select([
      'id', 'slug', 'reference', 'category_id as categoryId', 'state',
      'is_featured as isFeatured', 'is_professional as isProfessional', 'position',
      'published_at as publishedAt', 'created_at as createdAt', 'updated_at as updatedAt',
    ])
    .where('id', '=', id)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (!product) return null;

  const [translations, variants, media, needs] = await Promise.all([
    db
      .selectFrom('product_translations')
      .select([
        'locale', 'name', 'tagline', 'description', 'usage_notes as usage',
        'composition', 'precautions', 'storage',
        'meta_title as metaTitle', 'meta_description as metaDescription',
      ])
      .where('product_id', '=', id)
      .execute(),
    db
      .selectFrom('product_variants')
      .select([
        'id', 'sku', 'format', 'price', 'compare_at_price as compareAtPrice',
        'stock', 'low_stock_at as lowStockAt', 'allow_backorder as allowBackorder',
        'is_active as isActive', 'position',
      ])
      .where('product_id', '=', id)
      .orderBy('position')
      .execute(),
    db
      .selectFrom('product_media')
      .select(['id', 'path', 'alt', 'width', 'height', 'position'])
      .where('product_id', '=', id)
      .orderBy('position')
      .execute(),
    db.selectFrom('product_needs').select('need_id as needId').where('product_id', '=', id).execute(),
  ]);

  return { ...product, translations, variants, media, needIds: needs.map((n) => n.needId) };
}

/**
 * Creates or updates a product, its three translations and all its variants in
 * one transaction — a half-saved product with a French name and no price is not
 * a state the admin should ever be able to produce.
 */
export async function saveProduct(input: ProductInput): Promise<string> {
  if (input.variants.length === 0) {
    throw new AppError('validation_failed', 'at_least_one_variant');
  }

  const skus = input.variants.map((variant) => variant.sku.trim());
  if (new Set(skus).size !== skus.length) {
    throw new AppError('validation_failed', 'duplicate_sku');
  }

  return db.transaction().execute(async (trx) => {
    const productId = input.id ?? newId();

    const clash = await trx
      .selectFrom('products')
      .select('id')
      .where('slug', '=', input.slug)
      .where('id', '!=', productId)
      .executeTakeFirst();
    if (clash) throw new AppError('conflict', 'slug_taken');

    if (input.id) {
      await trx
        .updateTable('products')
        .set({
          slug: input.slug,
          reference: input.reference,
          category_id: input.categoryId,
          state: input.state,
          is_featured: input.isFeatured,
          is_professional: input.isProfessional,
          position: input.position,
          published_at: input.state === 'PUBLISHED' ? new Date() : null,
        })
        .where('id', '=', productId)
        .execute();
    } else {
      await trx
        .insertInto('products')
        .values({
          id: productId,
          slug: input.slug,
          reference: input.reference,
          category_id: input.categoryId,
          state: input.state,
          is_featured: input.isFeatured,
          is_professional: input.isProfessional,
          position: input.position,
          published_at: input.state === 'PUBLISHED' ? new Date() : null,
        })
        .execute();
    }

    for (const translation of input.translations) {
      const existing = await trx
        .selectFrom('product_translations')
        .select('id')
        .where('product_id', '=', productId)
        .where('locale', '=', translation.locale)
        .executeTakeFirst();

      const values = {
        name: translation.name,
        tagline: translation.tagline,
        description: translation.description,
        usage_notes: translation.usage,
        composition: translation.composition,
        precautions: translation.precautions,
        storage: translation.storage,
        meta_title: translation.metaTitle,
        meta_description: translation.metaDescription,
      };

      if (existing) {
        await trx.updateTable('product_translations').set(values).where('id', '=', existing.id).execute();
      } else {
        await trx
          .insertInto('product_translations')
          .values({ id: newId(), product_id: productId, locale: translation.locale, ...values })
          .execute();
      }
    }

    // Variants are reconciled rather than replaced: deleting and re-inserting
    // would break the order_lines foreign key and orphan stock movements.
    const existingVariants = await trx
      .selectFrom('product_variants')
      .select(['id'])
      .where('product_id', '=', productId)
      .execute();

    const keptIds = new Set(input.variants.map((variant) => variant.id).filter(Boolean) as string[]);

    for (const variant of input.variants) {
      const values = {
        sku: variant.sku.trim(),
        format: variant.format.trim(),
        price: variant.price,
        compare_at_price: variant.compareAtPrice,
        stock: variant.stock,
        low_stock_at: variant.lowStockAt,
        allow_backorder: variant.allowBackorder,
        is_active: variant.isActive,
        position: variant.position,
      };

      if (variant.id) {
        await trx.updateTable('product_variants').set(values).where('id', '=', variant.id).execute();
      } else {
        await trx
          .insertInto('product_variants')
          .values({ id: newId(), product_id: productId, ...values })
          .execute();
      }
    }

    // A removed variant is deactivated, never deleted, while an order still
    // references it. Deactivation hides it from the storefront and keeps every
    // historical order readable.
    for (const existing of existingVariants) {
      if (keptIds.has(existing.id)) continue;
      const referenced = await trx
        .selectFrom('order_lines')
        .select('id')
        .where('variant_id', '=', existing.id)
        .limit(1)
        .executeTakeFirst();

      if (referenced) {
        await trx
          .updateTable('product_variants')
          .set({ is_active: false })
          .where('id', '=', existing.id)
          .execute();
      } else {
        await trx.deleteFrom('product_variants').where('id', '=', existing.id).execute();
      }
    }

    await trx.deleteFrom('product_needs').where('product_id', '=', productId).execute();
    if (input.needIds.length > 0) {
      await trx
        .insertInto('product_needs')
        .values(input.needIds.map((needId) => ({ product_id: productId, need_id: needId })))
        .execute();
    }

    return productId;
  });
}

export async function setProductState(
  id: string,
  state: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED',
): Promise<void> {
  await db
    .updateTable('products')
    .set({ state, published_at: state === 'PUBLISHED' ? new Date() : null })
    .where('id', '=', id)
    .execute();
}

/**
 * Soft delete. A product referenced by an order is never removed from the
 * database — the order's own snapshot keeps it readable, but the row has to
 * survive for the foreign key and for analytics.
 */
export async function softDeleteProduct(id: string): Promise<void> {
  await db
    .updateTable('products')
    .set({ deleted_at: new Date(), state: 'ARCHIVED' })
    .where('id', '=', id)
    .execute();
  await db.updateTable('product_variants').set({ is_active: false }).where('product_id', '=', id).execute();
}

export async function adjustStock(
  variantId: string,
  delta: number,
  adminId: string,
  note?: string,
): Promise<void> {
  await db.transaction().execute(async (trx) => {
    const updated = await trx
      .updateTable('product_variants')
      .set((eb) => ({ stock: sql<number>`GREATEST(${eb.ref('stock')} + ${delta}, 0)` }))
      .where('id', '=', variantId)
      .executeTakeFirst();

    if (Number(updated.numUpdatedRows ?? 0) === 0) throw new AppError('not_found', 'variant_not_found');

    await trx
      .insertInto('stock_movements')
      .values({
        variant_id: variantId,
        delta,
        reason: delta > 0 ? 'RESTOCK' : 'MANUAL_ADJUSTMENT',
        reference: note?.slice(0, 64) ?? null,
        admin_id: adminId,
      })
      .execute();
  });
}
