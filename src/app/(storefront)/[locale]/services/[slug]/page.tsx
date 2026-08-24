import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/config';
import { getTranslator } from '@/i18n/translate';
import { getService, getServices } from '@/modules/reservations/catalog';
import { MediaFrame } from '@/components/ui/MediaFrame';
import { ButtonLink } from '@/components/ui/Button';
import { RichText } from '@/components/ui/Disclosure';
import { routes } from '@/lib/routes';
import { formatMoney } from '@/lib/money';

type Props = { params: Promise<{ locale: string; slug: string }> };

export const revalidate = 900;

export async function generateStaticParams() {
  const services = await getServices('fr');
  return services.flatMap((service) =>
    ['fr', 'en', 'ar'].map((locale) => ({ locale, slug: service.slug })),
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const service = await getService(locale, slug);
  if (!service) return {};
  return {
    title: service.metaTitle ?? service.name,
    description: service.metaDescription ?? service.tagline ?? undefined,
    alternates: { canonical: routes.service(locale, service.slug) },
  };
}

export default async function ServiceDetailPage({ params }: Props) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();

  const service = await getService(locale, slug);
  if (!service) notFound();
  const t = getTranslator(locale);

  return (
    <article data-surface="paper" className="bg-[var(--surface-bg)] text-[var(--surface-fg)]">
      <div className="container-page grid gap-10 py-12 lg:grid-cols-12 lg:gap-16 lg:py-20">
        <div className="lg:col-span-7">
          <MediaFrame
            path={service.coverPath}
            alt=""
            ratio="3 / 2"
            sizes="(max-width: 1024px) 92vw, 55vw"
            priority
            pendingLabel={t('product.imagePending')}
            expected="1800 × 1200"
          />
        </div>

        <div className="lg:col-span-5">
          <h1 className="font-display text-[length:var(--text-2xl)]">{service.name}</h1>
          {service.tagline ? (
            <p className="mt-4 leading-relaxed text-[var(--surface-muted)]">{service.tagline}</p>
          ) : null}

          <dl className="mt-8 grid grid-cols-2 gap-6 border-y border-[var(--surface-line)] py-6 text-sm">
            <div>
              <dt className="lockup text-[var(--surface-muted)]">{t('services.duration', { minutes: '' }).trim()}</dt>
              <dd className="mt-2">{t('services.duration', { minutes: service.durationMin })}</dd>
            </div>
            {service.price ? (
              <div>
                <dt className="lockup text-[var(--surface-muted)]">{t('cart.total')}</dt>
                <dd className="mt-2 tabular-nums">{formatMoney(service.price, locale)}</dd>
              </div>
            ) : null}
            {service.locationName ? (
              <div className="col-span-2">
                <dt className="lockup text-[var(--surface-muted)]">{t('services.location')}</dt>
                <dd className="mt-2">
                  {service.locationName}
                  {service.locationAddress ? (
                    <span className="block text-[var(--surface-muted)]">{service.locationAddress}</span>
                  ) : null}
                </dd>
              </div>
            ) : null}
          </dl>

          {service.description ? (
            <div className="mt-8 text-sm leading-relaxed text-[var(--surface-muted)]">
              <RichText value={service.description} />
            </div>
          ) : null}

          {service.preparation ? (
            <div className="mt-8">
              <h2 className="lockup text-[var(--surface-accent)]">{t('services.preparation')}</h2>
              <div className="mt-3 text-sm leading-relaxed text-[var(--surface-muted)]">
                <RichText value={service.preparation} />
              </div>
            </div>
          ) : null}

          <ButtonLink href={routes.book(locale, service.slug)} size="lg" className="mt-10">
            {t('services.book')}
          </ButtonLink>
        </div>
      </div>
    </article>
  );
}
