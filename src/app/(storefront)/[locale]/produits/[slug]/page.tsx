import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isLocale, LOCALE_META, type AppLocale } from '@/i18n/config';
import { getTranslator } from '@/i18n/translate';
import { getProduct, getProductSitemapEntries, getRelatedProducts } from '@/modules/catalog/service';
import { routes } from '@/lib/routes';
import { env } from '@/lib/env';
import { mediaUrl } from '@/modules/media/url';
import { ProductGallery } from '@/components/store/ProductGallery';
import { BuyPanel } from '@/components/store/BuyPanel';
import { ProductCard } from '@/components/store/ProductCard';
import { Disclosure, RichText } from '@/components/ui/Disclosure';
import { Price } from '@/components/ui/Price';
import { SectionSeam } from '@/components/brand/Petals';

type Props = { params: Promise<{ locale: string; slug: string }> };

export const revalidate = 3600;

export async function generateStaticParams() {
  const products = await getProductSitemapEntries();
  return products.slice(0, 200).flatMap((product) =>
    ['fr', 'en', 'ar'].map((locale) => ({ locale, slug: product.slug })),
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const product = await getProduct(locale, slug);
  if (!product) return {};

  const image = mediaUrl(product.image?.path);

  return {
    title: product.metaTitle ?? product.name,
    description: product.metaDescription ?? product.tagline ?? undefined,
    alternates: {
      canonical: routes.product(locale, product.slug),
      languages: Object.fromEntries(
        (['fr', 'en', 'ar'] as AppLocale[]).map((l) => [
          LOCALE_META[l].htmlLang,
          routes.product(l, product.slug),
        ]),
      ),
    },
    openGraph: {
      type: 'website',
      title: product.metaTitle ?? product.name,
      description: product.metaDescription ?? product.tagline ?? undefined,
      // Falls back to the brand card rather than to nothing: a product whose
      // photography has not been supplied yet still shares as BOA.
      images: [{ url: image ?? `/brand/og-${locale}.png` }],
    },
  };
}

export default async function ProductPage({ params }: Props) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();

  const product = await getProduct(locale, slug);
  if (!product) notFound();

  const t = getTranslator(locale);
  const related = await getRelatedProducts(locale, product.id, 3);

  /**
   * Structured data is emitted only from fields that actually exist. An offer
   * with an invented availability or a rating with no reviews behind it is a
   * lie to a search engine as much as to a customer.
   */
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    ...(product.description ? { description: product.description } : {}),
    ...(product.reference ? { sku: product.reference } : {}),
    brand: { '@type': 'Brand', name: 'BOA Cosmetic' },
    ...(product.image ? { image: [`${env.NEXT_PUBLIC_SITE_URL}${mediaUrl(product.image.path)}`] } : {}),
    offers: product.variants.map((variant) => ({
      '@type': 'Offer',
      sku: variant.sku,
      price: variant.price,
      priceCurrency: 'TND',
      availability:
        variant.stock > 0 || variant.allowBackorder
          ? 'https://schema.org/InStock'
          : 'https://schema.org/OutOfStock',
      url: `${env.NEXT_PUBLIC_SITE_URL}${routes.product(locale, product.slug)}`,
    })),
  };

  const sections = [
    { key: 'description', title: t('product.description'), value: product.description },
    { key: 'usage', title: t('product.usage'), value: product.usage },
    { key: 'composition', title: t('product.composition'), value: product.composition },
    { key: 'precautions', title: t('product.precautions'), value: product.precautions },
    { key: 'storage', title: t('product.storage'), value: product.storage },
  ].filter((section) => Boolean(section.value));

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <article data-surface="paper" className="bg-[var(--surface-bg)] text-[var(--surface-fg)]">
        <nav aria-label="Breadcrumb" className="container-page pt-8">
          <ol className="flex flex-wrap items-center gap-2 text-xs text-[var(--surface-muted)]">
            <li>
              <Link href={routes.shop(locale)} className="hover:text-[var(--surface-fg)]">
                {t('shop.title')}
              </Link>
            </li>
            {product.categorySlug && product.categoryName ? (
              <>
                <li aria-hidden="true">/</li>
                <li>
                  <Link
                    href={routes.category(locale, product.categorySlug)}
                    className="hover:text-[var(--surface-fg)]"
                  >
                    {product.categoryName}
                  </Link>
                </li>
              </>
            ) : null}
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="text-[var(--surface-fg)]">
              {product.name}
            </li>
          </ol>
        </nav>

        {/* Phase one: everything needed to decide and buy. */}
        <div className="container-page grid gap-10 py-10 lg:grid-cols-12 lg:gap-16 lg:py-16">
          <div className="lg:col-span-7">
            <ProductGallery
              media={product.media}
              productName={product.name}
              labels={{
                gallery: t('product.gallery'),
                pending: t('product.imagePending'),
                close: t('common.close'),
                zoom: t('common.zoom'),
              }}
            />
          </div>

          <div className="lg:col-span-5 lg:pt-4">
            {product.needs.length > 0 ? (
              <ul className="mb-5 flex flex-wrap gap-2">
                {product.needs.map((need) => (
                  <li key={need.slug}>
                    <Link
                      href={`${routes.shop(locale)}?besoin=${encodeURIComponent(need.slug)}`}
                      className="inline-flex min-h-8 items-center rounded-full border border-[var(--surface-line)] px-3 text-[13px] font-semibold text-[var(--surface-muted)] hover:border-[var(--surface-fg)] hover:text-[var(--surface-fg)]"
                    >
                      {need.name}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}

            <h1 className="font-display text-[length:var(--text-2xl)]">{product.name}</h1>

            {product.tagline ? (
              <p className="mt-4 leading-relaxed text-[var(--surface-muted)]">{product.tagline}</p>
            ) : null}

            <Price
              amount={product.priceFrom}
              compareAt={product.compareAtFrom}
              locale={locale}
              fromLabel={product.formatCount > 1 ? t('common.from') : undefined}
              className="mt-6 text-xl"
            />

            <div className="mt-10">
              <BuyPanel
                variants={product.variants}
                locale={locale}
                productName={product.name}
                labels={{
                  chooseFormat: t('product.chooseFormat'),
                  quantity: t('common.quantity'),
                  add: t('product.addToCart'),
                  added: t('product.added'),
                  soldOut: t('product.outOfStock'),
                  lowStock: t('product.lowStock', { count: '{count}' }),
                  error: t('errors.generic'),
                  decrease: t('common.decrease'),
                  increase: t('common.increase'),
                }}
              />
            </div>

            {/* Phase two: the questions that come after "should I buy this". */}
            {sections.length > 0 ? (
              <div className="mt-12">
                {sections.map((section, index) => (
                  <Disclosure key={section.key} title={section.title} defaultOpen={index === 0}>
                    <RichText value={section.value!} />
                  </Disclosure>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        {related.length > 0 ? (
          <div className="container-page pb-[var(--spacing-section)]">
            <SectionSeam />
            <h2 className="font-display mt-12 text-[length:var(--text-xl)]">
              {t('product.relatedHeading')}
            </h2>
            <ul className="mt-8 grid grid-cols-2 gap-x-6 gap-y-10 lg:grid-cols-3 lg:gap-8">
              {related.map((item) => (
                <li key={item.id}>
                  <ProductCard product={item} locale={locale} />
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </article>
    </>
  );
}
