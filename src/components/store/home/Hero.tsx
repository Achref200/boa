import Link from 'next/link';
import type { AppLocale } from '@/i18n/config';
import { getTranslator } from '@/i18n/translate';
import { routes } from '@/lib/routes';
import { MediaFrame } from '@/components/ui/MediaFrame';
import { Petals } from '@/components/brand/Petals';
import { Price } from '@/components/ui/Price';
import { ButtonLink } from '@/components/ui/Button';
import type { ProductCard } from '@/modules/catalog/types';
import type { ContentBlock } from '@/modules/content/service';

/**
 * The opening is a masthead, not a slideshow.
 *
 * A 5|7 split rather than a centred stack, an eyebrow sitting on a full-width
 * hairline the way a newspaper nameplate does, and the product frame dropped
 * below the headline's baseline so the two columns interlock instead of sitting
 * in parallel boxes. One product, chosen in the admin — a carousel is what you
 * build when you cannot decide what matters.
 */
export function Hero({
  locale,
  block,
  product,
}: {
  locale: AppLocale;
  block: ContentBlock | undefined;
  product: ProductCard | null;
}) {
  const t = getTranslator(locale);
  const heading = block?.heading ?? t('home.openingTagline');

  return (
    <section data-surface="paper" className="relative bg-[var(--surface-bg)] text-[var(--surface-fg)]">
      <div className="container-page pt-10 pb-16 lg:pt-16 lg:pb-24">
        <div className="flex items-center gap-6">
          <p className="lockup shrink-0 text-[var(--surface-accent)]">
            {block?.eyebrow ?? 'Sousse, Tunisie'}
          </p>
          <span className="rule-gold flex-1" />
        </div>

        <div className="mt-10 grid gap-10 lg:mt-14 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-5 lg:pt-6">
            <h1 className="font-display text-[length:var(--text-4xl)]">{heading}</h1>

            {block?.body ? (
              <p className="mt-8 max-w-sm text-md leading-relaxed text-[var(--surface-muted)]">
                {block.body}
              </p>
            ) : null}

            <div className="mt-10 flex flex-wrap items-center gap-4">
              <ButtonLink href={routes.shop(locale)} size="lg">
                {block?.ctaLabel ?? t('common.discover')}
              </ButtonLink>
              <Link
                href={routes.rituals(locale)}
                className="text-xs uppercase tracking-[0.14em] text-[var(--surface-muted)] underline-offset-8 hover:text-[var(--surface-fg)] hover:underline"
              >
                {t('nav.rituals')}
              </Link>
            </div>
          </div>

          {/* The frame starts lower than the headline so the columns interlock. */}
          <div className="relative lg:col-span-6 lg:col-start-7 lg:mt-16">
            {product ? (
              <Link href={routes.product(locale, product.slug)} className="group block">
                <div className="relative">
                  <span
                    className="absolute -top-6 bottom-0 hidden w-px bg-[var(--surface-line)] lg:block"
                    style={{ insetInlineStart: '-2rem' }}
                    aria-hidden="true"
                  />
                  <MediaFrame
                    path={product.image?.path}
                    alt={product.image?.alt ?? product.name}
                    ratio="4 / 5"
                    sizes="(max-width: 1024px) 92vw, 44vw"
                    priority
                    pendingLabel={t('product.imagePending')}
                    expected="1600 × 2000"
                    className="transition-transform duration-700 ease-[var(--ease-boa)] motion-safe:group-hover:scale-[1.02]"
                  />
                </div>

                <div className="mt-5 flex items-end justify-between gap-6">
                  <div>
                    <h2 className="font-display text-xl">{product.name}</h2>
                    {product.tagline ? (
                      <p className="mt-1 text-sm text-[var(--surface-muted)]">{product.tagline}</p>
                    ) : null}
                  </div>
                  <Price
                    amount={product.priceFrom}
                    locale={locale}
                    metal
                    className="text-lg"
                    fromLabel={product.formatCount > 1 ? t('common.from') : undefined}
                  />
                </div>
              </Link>
            ) : (
              <div className="media-pending flex aspect-[4/5] flex-col items-center justify-center gap-3">
                <Petals size={32} />
                <p className="lockup">{t('home.emptyCatalogue')}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
