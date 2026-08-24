import Link from 'next/link';
import type { AppLocale } from '@/i18n/config';
import { getTranslator } from '@/i18n/translate';
import { routes } from '@/lib/routes';
import { IconArrowRight, IconCalendar } from '@/components/ui/icons';
import type { ServiceView } from '@/modules/reservations/catalog';
import type { ContentBlock } from '@/modules/content/service';

/**
 * Hidden entirely when BOA has no published service — an empty "Book now" band
 * would be worse than no band. When services exist they are listed plainly with
 * duration and location, because those are what decide whether someone books.
 */
export function ServicesInvite({
  locale,
  services,
  block,
}: {
  locale: AppLocale;
  services: ServiceView[];
  block: ContentBlock | undefined;
}) {
  const t = getTranslator(locale);
  if (services.length === 0) return null;

  return (
    <section data-surface="ink" className="bg-[var(--surface-bg)] text-[var(--surface-fg)]">
      <div className="container-page py-[var(--spacing-section)]">
        <div className="grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <p className="lockup text-[var(--surface-accent)]">
              {block?.eyebrow ?? t('home.servicesEyebrow')}
            </p>
            <h2 className="font-display mt-5 text-[length:var(--text-2xl)]">
              {block?.heading ?? t('services.title')}
            </h2>
          </div>

          <ul className="lg:col-span-8">
            {services.slice(0, 4).map((service) => (
              <li key={service.id} className="border-t border-[var(--surface-line)] last:border-b">
                <Link
                  href={routes.service(locale, service.slug)}
                  className="group flex flex-wrap items-center gap-x-8 gap-y-2 py-6 transition-colors hover:text-[var(--surface-accent)]"
                >
                  <IconCalendar width={18} height={18} className="shrink-0 text-[var(--surface-muted)]" />
                  <span className="font-display flex-1 text-[length:var(--text-lg)]">{service.name}</span>
                  <span className="text-xs uppercase tracking-[0.12em] text-[var(--surface-muted)]">
                    {t('services.duration', { minutes: service.durationMin })}
                  </span>
                  {service.locationName ? (
                    <span className="hidden text-xs text-[var(--surface-muted)] sm:inline">
                      {service.locationName}
                    </span>
                  ) : null}
                  <IconArrowRight width={18} height={18} className="shrink-0 rtl:-scale-x-100" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
