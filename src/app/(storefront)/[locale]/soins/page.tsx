import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/config';
import { getTranslator } from '@/i18n/translate';
import {
  CatalogueView,
  parseCatalogueParams,
  type RawSearchParams,
} from '@/components/store/CatalogueView';
import { routes } from '@/lib/routes';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<RawSearchParams>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getTranslator(locale);
  return {
    title: t('shop.title'),
    alternates: { canonical: routes.shop(locale) },
    // Filtered and paged views are crawlable but not indexed: they are the same
    // products in a different order, and indexing them competes with the
    // category pages that should rank.
    robots: { index: true, follow: true },
  };
}

export default async function ShopPage({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const query = await searchParams;
  const t = getTranslator(locale);

  return (
    <CatalogueView
      locale={locale}
      query={parseCatalogueParams(query)}
      basePath={routes.shop(locale)}
      searchParams={query}
      title={t('shop.title')}
    />
  );
}
