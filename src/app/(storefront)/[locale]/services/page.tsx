import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/config';
import { getTranslator } from '@/i18n/translate';
import { getServices } from '@/modules/reservations/catalog';
import { MediaFrame } from '@/components/ui/MediaFrame';
import { Petals } from '@/components/brand/Petals';
import { routes } from '@/lib/routes';
import { formatMoney } from '@/lib/money';

export const revalidate = 900;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getTranslator(locale);
  return { title: t('services.title'), alternates: { canonical: routes.services(locale) } };
}

export default async function ServicesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const t = getTranslator(locale);
  const services = await getServices(locale);

  return (
    <section data-surface="paper" className="bg-[var(--surface-bg)] text-[var(--surface-fg)]">
      <div className="container-page py-12 lg:py-20">
        <h1 className="font-display text-[length:var(--text-3xl)]">{t('services.title')}</h1>

        {services.length === 0 ? (
          <div className="mt-12 flex flex-col items-center gap-4 rounded-md border border-[var(--surface-line)] px-6 py-24 text-center">
            <Petals size={32} className="text-[var(--surface-accent)]" />
            <p className="text-sm text-[var(--surface-muted)]">{t('services.noneAvailable')}</p>
          </div>
        ) : (
          <ul className="mt-12 grid gap-12 lg:grid-cols-2 lg:gap-x-8 lg:gap-y-16">
            {services.map((service, index) => (
              <li key={service.id}>
                <Link href={routes.service(locale, service.slug)} className="group block">
                  <MediaFrame
                    path={service.coverPath}
                    alt=""
                    ratio="3 / 2"
                    sizes="(max-width: 1024px) 92vw, 45vw"
                    priority={index === 0}
                    pendingLabel={t('product.imagePending')}
                    expected="1800 × 1200"
                    className="transition-transform duration-700 ease-[var(--ease-boa)] motion-safe:group-hover:scale-[1.02]"
                  />
                  <h2 className="font-display mt-5 text-[length:var(--text-xl)] group-hover:text-[var(--surface-accent)]">
                    {service.name}
                  </h2>
                  {service.tagline ? (
                    <p className="mt-2 text-sm text-[var(--surface-muted)]">{service.tagline}</p>
                  ) : null}
                  <p className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs uppercase tracking-[0.12em] text-[var(--surface-muted)]">
                    <span>{t('services.duration', { minutes: service.durationMin })}</span>
                    {service.price ? <span>{formatMoney(service.price, locale)}</span> : null}
                    {service.locationName ? <span>{service.locationName}</span> : null}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
