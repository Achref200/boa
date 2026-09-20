import 'server-only';
import { unstable_cache } from 'next/cache';
import { withBuildFallback } from '@/db/build-guard';
import type { AppLocale } from '@/i18n/config';
import {
  fetchNavigation,
  fetchNeeds,
  fetchProductBySlug,
  fetchProducts,
  fetchPublishedProductSlugs,
  fetchRelatedProducts,
} from './repository';
import type { Paginated, ProductCard, ProductDetail, ProductQuery, Navigation } from './types';

/**
 * Cache tags, so publishing from the admin invalidates exactly what changed
 * instead of dropping the whole cache or waiting for a timed revalidate.
 */
export const CATALOG_TAG = 'catalog';
export const productTag = (slug: string) => `product:${slug}`;

const HOUR = 3600;

export const EMPTY_NAVIGATION: Navigation = { categories: [], needs: [] };

export const getNavigation = (locale: AppLocale) =>
  unstable_cache(() => withBuildFallback(EMPTY_NAVIGATION, () => fetchNavigation(locale)), ['navigation', locale], {
    tags: [CATALOG_TAG],
    revalidate: HOUR,
  })();

export const getNeeds = (locale: AppLocale) =>
  unstable_cache(() => withBuildFallback([], () => fetchNeeds(locale)), ['needs', locale], {
    tags: [CATALOG_TAG],
    revalidate: HOUR,
  })();

/**
 * Listing results are cached per exact query. The key is derived from the
 * normalised query so `?besoin=a&besoin=b` and `?besoin=b&besoin=a` share one
 * entry rather than doubling the cache.
 */
export function getProducts(
  locale: AppLocale,
  query: ProductQuery,
): Promise<Paginated<ProductCard>> {
  const normalised: ProductQuery = {
    ...query,
    needSlugs: query.needSlugs ? [...query.needSlugs].sort() : undefined,
  };
  const key = JSON.stringify(normalised);
  const fallback: Paginated<ProductCard> = {
    items: [],
    total: 0,
    page: 1,
    perPage: normalised.perPage ?? 24,
    pageCount: 1,
  };
  return unstable_cache(
    () => withBuildFallback(fallback, () => fetchProducts(locale, normalised)),
    ['products', locale, key],
    {
      tags: [CATALOG_TAG],
      revalidate: 300,
    },
  )();
}

export const getProduct = (locale: AppLocale, slug: string): Promise<ProductDetail | null> =>
  unstable_cache(() => withBuildFallback(null, () => fetchProductBySlug(locale, slug)), ['product', locale, slug], {
    tags: [CATALOG_TAG, productTag(slug)],
    revalidate: HOUR,
  })();

export const getRelatedProducts = (locale: AppLocale, productId: string, limit?: number) =>
  unstable_cache(
    () => withBuildFallback([], () => fetchRelatedProducts(locale, productId, limit)),
    ['related', locale, productId, String(limit ?? 4)],
    { tags: [CATALOG_TAG], revalidate: HOUR },
  )();

export const getFeaturedProducts = (locale: AppLocale, limit = 3) =>
  getProducts(locale, { sort: 'relevance', perPage: limit, page: 1 });

export const getProductSitemapEntries = () =>
  unstable_cache(() => withBuildFallback([], () => fetchPublishedProductSlugs()), ['sitemap-products'], {
    tags: [CATALOG_TAG],
    revalidate: HOUR,
  })();

export type { ProductCard, ProductDetail, ProductQuery, Paginated };
