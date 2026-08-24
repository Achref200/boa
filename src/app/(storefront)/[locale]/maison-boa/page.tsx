import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/config';
import { getTranslator } from '@/i18n/translate';
import { getPageBlocks, getSiteSettings } from '@/modules/content/service';
import { MediaFrame } from '@/components/ui/MediaFrame';
import { SectionSeam } from '@/components/brand/Petals';
import { RichText } from '@/components/ui/Disclosure';
import { ButtonLink } from '@/components/ui/Button';
import { routes } from '@/lib/routes';

export const revalidate = 900;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getTranslator(locale);
  return { title: t('nav.house'), alternates: { canonical: routes.house(locale) } };
}

/**
 * The brand page.
 *
 * Its content is entirely admin-authored: BOA's story is BOA's to tell, and
 * inventing a founding year or a manufacturing claim here would be exactly the
 * kind of fabrication this project refuses. Until the blocks are filled in, the
 * page states the two things that are actually confirmed — the city and what
 * BOA makes — and nothing else.
 */
export default async function HousePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const t = getTranslator(locale);
  const [blocks, homeBlocks, settings] = await Promise.all([
    getPageBlocks(locale, 'maison'),
    getPageBlocks(locale, 'home'),
    getSiteSettings(),
  ]);

  const sections = blocks.length > 0 ? blocks : homeBlocks.filter((block) => block.kind === 'maison');
  const [lead, ...rest] = sections;

  return (
    <article>
      <section data-surface="ink" className="bg-[var(--surface-bg)] text-[var(--surface-fg)]">
        <div className="container-page py-16 lg:py-28">
          <p className="lockup text-[var(--surface-accent)]">
            {lead?.eyebrow ?? t('home.houseEyebrow')}
          </p>
          <h1 className="font-display mt-8 max-w-4xl text-[length:var(--text-3xl)]">
            {lead?.heading ?? t('home.openingTagline')}
          </h1>
          {lead?.body ? (
            <div className="mt-8 max-w-[var(--container-reading)] leading-relaxed text-[var(--surface-muted)]">
              <RichText value={lead.body} />
            </div>
          ) : null}

          <dl className="mt-14 grid gap-8 border-t border-[var(--surface-line)] pt-10 sm:grid-cols-3">
            <div>
              <dt className="lockup text-[var(--surface-muted)]">{t('checkout.city')}</dt>
              <dd className="font-display mt-3 text-[length:var(--text-lg)]">
                {settings.city ?? 'Sousse'}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="lockup text-[var(--surface-muted)]">{t('nav.shop')}</dt>
              <dd className="mt-3 leading-relaxed text-[var(--surface-muted)]">
                {t('home.openingTagline')}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      {rest.length > 0 ? (
        <section data-surface="paper" className="bg-[var(--surface-bg)] text-[var(--surface-fg)]">
          <div className="container-page py-[var(--spacing-section)]">
            {rest.map((block, index) => (
              <div key={block.id} className={index > 0 ? 'mt-20' : ''}>
                <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
                  <div className={index % 2 === 0 ? 'lg:col-span-6' : 'lg:col-span-6 lg:order-2'}>
                    <MediaFrame
                      path={block.mediaPath}
                      alt=""
                      ratio="3 / 2"
                      sizes="(max-width: 1024px) 92vw, 45vw"
                      pendingLabel={t('product.imagePending')}
                      expected="1800 × 1200"
                    />
                  </div>
                  <div className="lg:col-span-5 lg:pt-6">
                    {block.eyebrow ? (
                      <p className="lockup text-[var(--surface-accent)]">{block.eyebrow}</p>
                    ) : null}
                    {block.heading ? (
                      <h2 className="font-display mt-5 text-[length:var(--text-xl)]">{block.heading}</h2>
                    ) : null}
                    {block.body ? (
                      <div className="mt-5 leading-relaxed text-[var(--surface-muted)]">
                        <RichText value={block.body} />
                      </div>
                    ) : null}
                  </div>
                </div>
                {index < rest.length - 1 ? (
                  <div className="mt-20">
                    <SectionSeam />
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section data-surface="paper" className="bg-[var(--surface-sunken)] text-[var(--surface-fg)]">
        <div className="container-page flex flex-wrap items-center justify-between gap-6 py-16">
          <p className="font-display text-[length:var(--text-lg)]">{t('home.needsHeading')}</p>
          <ButtonLink href={routes.shop(locale)}>{t('common.discover')}</ButtonLink>
        </div>
      </section>
    </article>
  );
}
