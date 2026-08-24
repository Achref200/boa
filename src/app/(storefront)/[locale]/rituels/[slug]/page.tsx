import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/config';
import { getTranslator } from '@/i18n/translate';
import { getRitual, getRituals } from '@/modules/catalog/rituals';
import { MediaFrame } from '@/components/ui/MediaFrame';
import { Price } from '@/components/ui/Price';
import { AddRitualButton } from '@/components/store/AddToCartButton';
import { SectionSeam } from '@/components/brand/Petals';
import { routes } from '@/lib/routes';

type Props = { params: Promise<{ locale: string; slug: string }> };

export const revalidate = 3600;

export async function generateStaticParams() {
  const rituals = await getRituals('fr', 50);
  return rituals.flatMap((ritual) =>
    ['fr', 'en', 'ar'].map((locale) => ({ locale, slug: ritual.slug })),
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const ritual = await getRitual(locale, slug);
  if (!ritual) return {};
  return {
    title: ritual.name,
    description: ritual.intro ?? undefined,
    alternates: { canonical: routes.ritual(locale, ritual.slug) },
  };
}

export default async function RitualPage({ params }: Props) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();

  const ritual = await getRitual(locale, slug);
  if (!ritual) notFound();

  const t = getTranslator(locale);
  const buyable = ritual.steps
    .map((step) => step.product)
    .filter((product): product is NonNullable<typeof product> => Boolean(product?.inStock));

  return (
    <article data-surface="paper" className="bg-[var(--surface-bg)] text-[var(--surface-fg)]">
      <div className="container-page py-12 lg:py-20">
        <nav aria-label="Breadcrumb" className="mb-8">
          <ol className="flex flex-wrap items-center gap-2 text-xs text-[var(--surface-muted)]">
            <li>
              <Link href={routes.rituals(locale)} className="hover:text-[var(--surface-fg)]">
                {t('rituals.title')}
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="text-[var(--surface-fg)]">
              {ritual.name}
            </li>
          </ol>
        </nav>

        <div className="flex flex-wrap items-end justify-between gap-8">
          <div className="max-w-[var(--container-reading)]">
            <h1 className="font-display text-[length:var(--text-3xl)]">{ritual.name}</h1>
            {ritual.intro ? (
              <p className="mt-5 leading-relaxed text-[var(--surface-muted)]">{ritual.intro}</p>
            ) : null}
          </div>

          <div className="flex flex-col items-start gap-3">
            <Price amount={ritual.total} locale={locale} fromLabel={t('rituals.totalLabel')} className="text-xl" />
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

        <div className="my-12">
          <SectionSeam />
        </div>

        <ol className="flex flex-col gap-16">
          {ritual.steps.map((step, index) => (
            <li key={step.id} className="grid gap-8 lg:grid-cols-12 lg:gap-12">
              <div className="lg:col-span-5">
                {step.product ? (
                  <Link href={routes.product(locale, step.product.slug)} className="group block">
                    <MediaFrame
                      path={step.product.imagePath}
                      alt={step.product.name}
                      sizes="(max-width: 1024px) 92vw, 40vw"
                      priority={index === 0}
                      pendingLabel={t('product.imagePending')}
                      expected="1200 × 1500"
                      className="transition-transform duration-700 ease-[var(--ease-boa)] motion-safe:group-hover:scale-[1.02]"
                    />
                  </Link>
                ) : null}
              </div>

              <div className="lg:col-span-6 lg:col-start-7 lg:pt-6">
                <p className="lockup text-[var(--surface-accent)]">
                  {t('rituals.step', { number: index + 1 })}
                </p>
                <h2 className="font-display mt-4 text-[length:var(--text-xl)]">{step.title}</h2>
                {step.body ? (
                  <p className="mt-4 leading-relaxed text-[var(--surface-muted)]">{step.body}</p>
                ) : null}

                {step.product ? (
                  <div className="mt-6">
                    <Link
                      href={routes.product(locale, step.product.slug)}
                      className="text-sm underline underline-offset-4 hover:text-[var(--surface-accent)]"
                    >
                      {step.product.name}
                    </Link>
                    <Price
                      amount={step.product.price}
                      locale={locale}
                      className="mt-1 text-sm text-[var(--surface-muted)]"
                    />
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </article>
  );
}
