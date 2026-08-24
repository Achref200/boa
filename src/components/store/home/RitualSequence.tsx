import Link from 'next/link';
import type { AppLocale } from '@/i18n/config';
import { getTranslator } from '@/i18n/translate';
import { routes } from '@/lib/routes';
import { MediaFrame } from '@/components/ui/MediaFrame';
import { Price } from '@/components/ui/Price';
import { AddRitualButton } from '@/components/store/AddToCartButton';
import type { RitualView } from '@/modules/catalog/rituals';
import type { ContentBlock } from '@/modules/content/service';

/**
 * A ritual is what separates BOA from a shop that lists bottles: an ordered
 * regimen, priced as a whole, addable in one tap.
 *
 * Presented as a numbered sequence rather than three equal cards, because the
 * order is the content. On a phone it scrolls horizontally with snap points, so
 * the step-after-step reading survives instead of collapsing into a list.
 */
export function RitualSequence({
  locale,
  ritual,
  block,
}: {
  locale: AppLocale;
  ritual: RitualView | undefined;
  block: ContentBlock | undefined;
}) {
  const t = getTranslator(locale);
  if (!ritual || ritual.steps.length === 0) return null;

  const buyable = ritual.steps
    .map((step) => step.product)
    .filter((product): product is NonNullable<typeof product> => Boolean(product?.inStock));

  return (
    <section data-surface="paper" className="bg-[var(--surface-sunken)] text-[var(--surface-fg)]">
      <div className="container-page py-[var(--spacing-section)]">
        <div className="flex flex-wrap items-end justify-between gap-8">
          <div>
            <p className="lockup text-[var(--surface-accent)]">
              {block?.eyebrow ?? t('home.ritualsEyebrow')}
            </p>
            <h2 className="font-display mt-5 text-[length:var(--text-2xl)]">
              {block?.heading ?? ritual.name}
            </h2>
            {ritual.intro ? (
              <p className="mt-4 max-w-md text-sm leading-relaxed text-[var(--surface-muted)]">
                {ritual.intro}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col items-start gap-3">
            <Price
              amount={ritual.total}
              locale={locale}
              fromLabel={t('rituals.totalLabel')}
              className="text-lg"
            />
            <AddRitualButton
              variantIds={buyable.map((product) => product.variantId)}
              labels={{
                add: t('rituals.addAll'),
                added: t('rituals.addedAll'),
                error: t('errors.generic'),
                soldOut: t('product.outOfStock'),
              }}
            />
          </div>
        </div>

        <ol className="scroll-x no-scrollbar mt-14 flex snap-x snap-mandatory gap-6 pb-2 sm:grid sm:grid-cols-3 sm:gap-8">
          {ritual.steps.map((step, index) => (
            <li
              key={step.id}
              className="w-[78vw] shrink-0 snap-start border-t border-[var(--surface-line)] pt-6 sm:w-auto"
            >
              <div className="flex items-baseline gap-4">
                <span className="font-display text-[length:var(--text-xl)] text-[var(--surface-accent)]">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <h3 className="font-display text-lg">{step.title}</h3>
              </div>

              {step.body ? (
                <p className="mt-3 text-sm leading-relaxed text-[var(--surface-muted)]">{step.body}</p>
              ) : null}

              {step.product ? (
                <Link href={routes.product(locale, step.product.slug)} className="group mt-6 block">
                  <MediaFrame
                    path={step.product.imagePath}
                    alt={step.product.name}
                    sizes="(max-width: 640px) 78vw, 28vw"
                    pendingLabel={t('product.imagePending')}
                    expected="1200 × 1500"
                    className="transition-transform duration-700 ease-[var(--ease-boa)] motion-safe:group-hover:scale-[1.03]"
                  />
                  <p className="mt-4 text-sm group-hover:text-[var(--surface-accent)]">
                    {step.product.name}
                  </p>
                  <Price
                    amount={step.product.price}
                    locale={locale}
                    className="mt-1 text-sm text-[var(--surface-muted)]"
                  />
                </Link>
              ) : null}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
