import type { MetadataRoute } from 'next';
import { LOCALES } from '@/i18n/config';
import { env } from '@/lib/env';
import { getProductSitemapEntries } from '@/modules/catalog/service';
import { getPublishedCategorySlugs } from '@/modules/catalog/categories';
import { getServices } from '@/modules/reservations/catalog';
import { routes } from '@/lib/routes';

export const revalidate = 3600;

/**
 * Only indexable pages appear here.
 *
 * The cart, checkout, confirmation, tracking, account and admin trees are all
 * absent by construction — they are either per-visitor or private, and listing
 * them would invite crawlers into pages that can only ever return an empty cart
 * or a redirect. Each entry declares its three locale alternates so Google
 * treats fr/en/ar as one page in three languages rather than as duplicates.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
  const [products, categories, services] = await Promise.all([
    getProductSitemapEntries(),
    getPublishedCategorySlugs(),
    getServices('fr'),
  ]);

  const withAlternates = (
    path: (locale: (typeof LOCALES)[number]) => string,
    lastModified?: Date,
  ): MetadataRoute.Sitemap =>
    LOCALES.map((locale) => ({
      url: `${base}${path(locale)}`,
      lastModified: lastModified ?? new Date(),
      alternates: {
        languages: Object.fromEntries(LOCALES.map((other) => [other, `${base}${path(other)}`])),
      },
    }));

  return [
    ...withAlternates((locale) => routes.home(locale)),
    ...withAlternates((locale) => routes.shop(locale)),
    ...withAlternates((locale) => routes.rituals(locale)),
    ...withAlternates((locale) => routes.services(locale)),
    ...withAlternates((locale) => routes.house(locale)),
    ...withAlternates((locale) => routes.professionals(locale)),
    ...withAlternates((locale) => routes.contact(locale)),
    ...categories.flatMap((category) =>
      withAlternates((locale) => routes.category(locale, category.slug), category.updatedAt),
    ),
    ...products.flatMap((product) =>
      withAlternates((locale) => routes.product(locale, product.slug), product.updatedAt),
    ),
    ...services.flatMap((service) => withAlternates((locale) => routes.service(locale, service.slug))),
  ];
}
