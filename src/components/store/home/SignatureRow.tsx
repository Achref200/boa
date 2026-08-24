import type { AppLocale } from '@/i18n/config';
import { getTranslator } from '@/i18n/translate';
import { routes } from '@/lib/routes';
import { ProductCard } from '@/components/store/ProductCard';
import { ButtonLink } from '@/components/ui/Button';
import { SectionSeam } from '@/components/brand/Petals';
import type { ProductCard as ProductCardData } from '@/modules/catalog/types';
import type { ContentBlock } from '@/modules/content/service';

/**
 * One large, two small. An even 3- or 4-up grid distributes attention equally,
 * which is exactly wrong for a range with a hero product — this row directs the
 * eye instead, and reads as a spread rather than a shelf.
 */
export function SignatureRow({
  locale,
  products,
  block,
}: {
  locale: AppLocale;
  products: ProductCardData[];
  block: ContentBlock | undefined;
}) {
  const t = getTranslator(locale);
  if (products.length === 0) return null;

  const [lead, ...rest] = products;
  if (!lead) return null;

  return (
    <section data-surface="paper" className="bg-[var(--surface-bg)] text-[var(--surface-fg)]">
      <div className="container-page">
        <SectionSeam />
      </div>

      <div className="container-page py-[var(--spacing-section)]">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="lockup text-[var(--surface-accent)]">
              {block?.eyebrow ?? t('home.signatureEyebrow')}
            </p>
            {block?.heading ? (
              <h2 className="font-display mt-5 text-[length:var(--text-2xl)]">{block.heading}</h2>
            ) : null}
          </div>
          <ButtonLink href={routes.shop(locale)} intent="quiet" size="sm">
            {t('common.seeAll')}
          </ButtonLink>
        </div>

        <div className="mt-12 grid gap-10 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-7">
            <ProductCard product={lead} locale={locale} size="feature" priority />
          </div>
          <div className="grid gap-10 sm:grid-cols-2 lg:col-span-5 lg:mt-20 lg:gap-8">
            {rest.slice(0, 2).map((product) => (
              <ProductCard key={product.id} product={product} locale={locale} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
