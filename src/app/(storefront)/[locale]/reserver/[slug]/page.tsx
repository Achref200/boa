import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isLocale, LOCALE_META } from '@/i18n/config';
import { getTranslator } from '@/i18n/translate';
import { getService } from '@/modules/reservations/catalog';
import { generateSlots, getAvailability } from '@/modules/reservations/availability';
import { getCurrentCustomer } from '@/modules/identity/session';
import { BookingCalendar, type BookableDay } from '@/components/store/BookingCalendar';
import { BUSINESS_TIMEZONE } from '@/lib/tz';
import { routes } from '@/lib/routes';

type Props = { params: Promise<{ locale: string; slug: string }> };

/** Availability changes with every booking, so this page is never cached. */
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const service = await getService(locale, slug);
  if (!service) return {};
  return {
    title: `${getTranslator(locale)('reservation.title')} — ${service.name}`,
    robots: { index: false, follow: true },
  };
}

export default async function BookingPage({ params }: Props) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();

  const service = await getService(locale, slug);
  if (!service) notFound();

  const t = getTranslator(locale);

  // Materialising on demand keeps the horizon rolling without a cron job. The
  // operation is idempotent, so concurrent page loads cannot duplicate slots.
  await generateSlots(service.id);

  const [availability, customer] = await Promise.all([
    getAvailability(service.id, {
      days: service.horizonDays,
      leadTimeHours: service.leadTimeHours,
    }),
    getCurrentCustomer(),
  ]);

  const intlLocale = LOCALE_META[locale].htmlLang;
  const timeFormatter = new Intl.DateTimeFormat(intlLocale, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: BUSINESS_TIMEZONE,
  });
  const dayFormatter = new Intl.DateTimeFormat(intlLocale, {
    day: 'numeric',
    month: 'short',
    timeZone: BUSINESS_TIMEZONE,
  });
  const weekdayFormatter = new Intl.DateTimeFormat(intlLocale, {
    weekday: 'short',
    timeZone: BUSINESS_TIMEZONE,
  });

  const days: BookableDay[] = availability.map((entry) => {
    const first = entry.slots[0]?.startsAt ?? new Date(`${entry.date}T12:00:00Z`);
    return {
      date: entry.date,
      dayLabel: dayFormatter.format(first),
      weekdayLabel: weekdayFormatter.format(first),
      slots: entry.slots.map((slot) => ({
        id: slot.id,
        time: timeFormatter.format(slot.startsAt),
        remaining: slot.remaining,
      })),
    };
  });

  return (
    <section data-surface="paper" className="bg-[var(--surface-bg)] text-[var(--surface-fg)]">
      <div className="container-page py-12 lg:py-20">
        <p className="lockup text-[var(--surface-accent)]">{t('reservation.title')}</p>
        <h1 className="font-display mt-5 text-[length:var(--text-3xl)]">{service.name}</h1>
        <p className="mt-4 text-sm text-[var(--surface-muted)]">
          {t('services.duration', { minutes: service.durationMin })}
          {service.locationName ? ` · ${service.locationName}` : ''}
        </p>

        <div className="mt-12 max-w-3xl">
          <BookingCalendar
            locale={locale}
            serviceId={service.id}
            days={days}
            confirmationBasePath={`/${locale}/reservation`}
            defaults={{
              firstName: customer?.firstName ?? '',
              lastName: customer?.lastName ?? '',
              email: customer?.email ?? '',
              phone: customer?.phone ?? '',
            }}
            labels={{
              chooseDate: t('reservation.chooseDate'),
              chooseSlot: t('reservation.chooseSlot'),
              noSlots: t('reservation.noSlots'),
              slotsLeft: t('reservation.slotsLeft', { count: '{count}' }),
              full: t('reservation.full'),
              yourDetails: t('reservation.yourDetails'),
              firstName: t('checkout.firstName'),
              lastName: t('checkout.lastName'),
              email: t('checkout.email'),
              phone: t('checkout.phone'),
              phoneHint: t('checkout.phoneHint'),
              note: t('reservation.note'),
              optional: t('common.optional'),
              confirm: t('reservation.confirm'),
              confirming: t('reservation.confirming'),
              slotTaken: t('reservation.slotTaken'),
              generic: t('errors.generic'),
              validation: t('errors.validation'),
              rateLimited: t('errors.rateLimited'),
              fieldInvalid: t('errors.fieldInvalid'),
            }}
          />
        </div>

        <p className="mt-10 text-xs text-[var(--surface-muted)]">
          <a href={routes.service(locale, service.slug)} className="underline underline-offset-4">
            {t('common.back')}
          </a>
        </p>
      </div>
    </section>
  );
}
