import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/config';
import { getTranslator } from '@/i18n/translate';
import { getCategory, categoryBranchSlugs, getPublishedCategorySlugs } from '@/modules/catalog/categories';
import {
  CatalogueView,
  parseCatalogueParams,
  type RawSearchParams,
} from '@/components/store/CatalogueView';
import { routes } from '@/lib/routes';

type Props = {
  params: Promise<{ locale: string; category: string }>;
  searchParams: Promise<RawSearchParams>;
};

export const revalidate = 900;

/** Category pages are the indexable surface of the catalogue, so they are built ahead of time. */
export async function generateStaticParams() {
  const categories = await getPublishedCategorySlugs();
  return categories.flatMap((category) =>
    ['fr', 'en', 'ar'].map((locale) => ({ locale, category: category.slug })),
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, category: slug } = await params;
  if (!isLocale(locale)) return {};
  const category = await getCategory(locale, slug);
  if (!category) return {};

  return {
    title: category.metaTitle ?? category.name,
    description: category.metaDescription ?? category.intro ?? undefined,
    alternates: { canonical: routes.category(locale, category.slug) },
    openGraph: { title: category.metaTitle ?? category.name, type: 'website' },
  };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { locale, category: slug } = await params;
  if (!isLocale(locale)) notFound();

  const category = await getCategory(locale, slug);
  if (!category) notFound();

  const query = await searchParams;
  const t = getTranslator(locale);
  const branch = await categoryBranchSlugs(locale, slug);

  return (
    <>
      <nav
        data-surface="paper"
        aria-label="Breadcrumb"
        className="bg-[var(--surface-bg)] text-[var(--surface-fg)]"
      >
        <ol className="container-page flex flex-wrap items-center gap-2 pt-8 text-xs text-[var(--surface-muted)]">
          <li>
            <Link href={routes.shop(locale)} className="hover:text-[var(--surface-fg)]">
              {t('shop.title')}
            </Link>
          </li>
          {category.parentSlug && category.parentName ? (
            <>
              <li aria-hidden="true">/</li>
              <li>
                <Link
                  href={routes.category(locale, category.parentSlug)}
                  className="hover:text-[var(--surface-fg)]"
                >
                  {category.parentName}
                </Link>
              </li>
            </>
          ) : null}
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="text-[var(--surface-fg)]">
            {category.name}
          </li>
        </ol>

        {category.children.length > 0 ? (
          <ul className="container-page mt-6 flex flex-wrap gap-2">
            {category.children.map((child) => (
              <li key={child.slug}>
                <Link
                  href={routes.category(locale, child.slug)}
                  className="inline-flex min-h-11 items-center rounded-full border border-[var(--surface-line)] px-4 text-sm font-semibold hover:border-[var(--surface-fg)]"
                >
                  {child.name}
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </nav>

      <CatalogueView
        locale={locale}
        query={{ ...parseCatalogueParams(query), categorySlugs: branch }}
        basePath={routes.category(locale, category.slug)}
        searchParams={query}
        title={category.name}
        intro={category.intro}
      />
    </>
  );
}
