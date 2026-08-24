import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/config';
import { getTranslator } from '@/i18n/translate';
import { getRituals } from '@/modules/catalog/rituals';
import { MediaFrame } from '@/components/ui/MediaFrame';
import { Price } from '@/components/ui/Price';
import { Petals } from '@/components/brand/Petals';
import { routes } from '@/lib/routes';

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getTranslator(locale);
  return { title: t('rituals.title'), alternates: { canonical: routes.rituals(locale) } };
}

export default async function RitualsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const t = getTranslator(locale);
  const rituals = await getRituals(locale, 12);

  return (
    <section data-surface="paper" className="bg-[var(--surface-bg)] text-[var(--surface-fg)]">
      <div className="container-page py-12 lg:py-20">
        <h1 className="font-display text-[length:var(--text-3xl)]">{t('rituals.title')}</h1>
        <p className="mt-5 max-w-[var(--container-reading)] leading-relaxed text-[var(--surface-muted)]">
          {t('home.ritualsHeading')}
        </p>

        {rituals.length === 0 ? (
          <div className="mt-12 flex flex-col items-center gap-4 rounded-md border border-[var(--surface-line)] px-6 py-24 text-center">
            <Petals size={32} className="text-[var(--surface-accent)]" />
            <p className="text-sm text-[var(--surface-muted)]">{t('home.emptyCatalogue')}</p>
          </div>
        ) : (
          <ul className="mt-14 flex flex-col gap-16">
            {rituals.map((ritual) => (
              <li key={ritual.id} className="border-t border-[var(--surface-line)] pt-10">
                <div className="flex flex-wrap items-end justify-between gap-6">
                  <div>
                    <Link href={routes.ritual(locale, ritual.slug)}>
                      <h2 className="font-display text-[length:var(--text-xl)] hover:text-[var(--surface-accent)]">
                        {ritual.name}
                      </h2>
                    </Link>
                    {ritual.intro ? (
                      <p className="mt-3 max-w-md text-sm leading-relaxed text-[var(--surface-muted)]">
                        {ritual.intro}
                      </p>
                    ) : null}
                  </div>
                  <Price
                    amount={ritual.total}
                    locale={locale}
                    fromLabel={t('rituals.totalLabel')}
                    className="text-lg"
                  />
                </div>

                <ol className="scroll-x no-scrollbar mt-8 flex snap-x gap-6 pb-2 sm:grid sm:grid-cols-3 sm:gap-8">
                  {ritual.steps.map((step, index) => (
                    <li key={step.id} className="w-[70vw] shrink-0 snap-start sm:w-auto">
                      <p className="lockup mb-3 text-[var(--surface-accent)]">
                        {t('rituals.step', { number: index + 1 })}
                      </p>
                      {step.product ? (
                        <Link href={routes.product(locale, step.product.slug)} className="group block">
                          <MediaFrame
                            path={step.product.imagePath}
                            alt={step.product.name}
                            sizes="(max-width: 640px) 70vw, 28vw"
                            pendingLabel={t('product.imagePending')}
                            expected="1200 × 1500"
                            className="transition-transform duration-700 ease-[var(--ease-boa)] motion-safe:group-hover:scale-[1.03]"
                          />
                          <p className="mt-3 text-sm group-hover:text-[var(--surface-accent)]">
                            {step.title} — {step.product.name}
                          </p>
                        </Link>
                      ) : (
                        <p className="text-sm">{step.title}</p>
                      )}
                    </li>
                  ))}
                </ol>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
