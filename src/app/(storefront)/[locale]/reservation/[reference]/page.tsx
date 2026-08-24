import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { isLocale } from '@/i18n/config';
import { getTranslator } from '@/i18n/translate';
import { db } from '@/db/client';
import { LAST_RESERVATION_COOKIE } from '@/modules/reservations/constants';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { SectionSeam } from '@/components/brand/Petals';
import { formatLongDateTime } from '@/lib/datetime';
import { formatMoney } from '@/lib/money';
import { routes } from '@/lib/routes';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return {
    title: getTranslator(locale)('reservation.confirmedTitle'),
    robots: { index: false, follow: false },
  };
}

/**
 * Gated by the httpOnly receipt cookie, exactly like the order confirmation:
 * a booking reference alone would otherwise reveal a stranger's name, phone
 * number and appointment time.
 */
export default async function ReservationConfirmationPage({
  params,
}: {
  params: Promise<{ locale: string; reference: string }>;
}) {
  const { locale, reference } = await params;
  if (!isLocale(locale)) notFound();

  const receipt = (await cookies()).get(LAST_RESERVATION_COOKIE)?.value;
  if (!receipt || receipt !== reference) redirect(routes.services(locale));

  const reservation = await db
    .selectFrom('reservations')
    .select([
      'reference', 'status', 'service_name as serviceName', 'starts_at as startsAt',
      'ends_at as endsAt', 'location_name as locationName', 'price_at_booking as price',
      'first_name as firstName', 'last_name as lastName', 'email', 'phone', 'note',
    ])
    .where('reference', '=', reference)
    .executeTakeFirst();

  if (!reservation) notFound();

  const t = getTranslator(locale);
  const when = formatLongDateTime(reservation.startsAt, locale);

  return (
    <section data-surface="paper" className="bg-[var(--surface-bg)] text-[var(--surface-fg)]">
      <div className="container-page py-16 lg:py-24">
        <div className="max-w-[var(--container-reading)]">
          <p className="lockup text-[var(--surface-accent)]">{reservation.reference}</p>
          <h1 className="font-display mt-5 text-[length:var(--text-3xl)]">
            {t('reservation.confirmedTitle')}
          </h1>
          <p className="mt-5 leading-relaxed text-[var(--surface-muted)]">
            {t('reservation.confirmedLead', { reference: reservation.reference, date: when })}
          </p>
        </div>

        <div className="my-12">
          <SectionSeam />
        </div>

        <dl className="grid max-w-3xl grid-cols-1 gap-6 text-sm sm:grid-cols-2">
          <div>
            <dt className="lockup text-[var(--surface-muted)]">{t('services.title')}</dt>
            <dd className="mt-2">{reservation.serviceName}</dd>
          </div>
          <div>
            <dt className="lockup text-[var(--surface-muted)]">{t('order.status')}</dt>
            <dd className="mt-2">
              <StatusBadge tone={reservation.status === 'CONFIRMED' ? 'positive' : 'caution'}>
                {t(`reservation.statuses.${reservation.status}` as 'reservation.statuses.PENDING')}
              </StatusBadge>
            </dd>
          </div>
          <div>
            <dt className="lockup text-[var(--surface-muted)]">{t('reservation.chooseDate')}</dt>
            <dd className="mt-2">{when}</dd>
          </div>
          {reservation.locationName ? (
            <div>
              <dt className="lockup text-[var(--surface-muted)]">{t('services.location')}</dt>
              <dd className="mt-2">{reservation.locationName}</dd>
            </div>
          ) : null}
          {reservation.price ? (
            <div>
              <dt className="lockup text-[var(--surface-muted)]">{t('cart.total')}</dt>
              <dd className="mt-2 tabular-nums">{formatMoney(reservation.price, locale)}</dd>
            </div>
          ) : null}
          <div>
            <dt className="lockup text-[var(--surface-muted)]">{t('reservation.yourDetails')}</dt>
            <dd className="mt-2">
              {reservation.firstName} {reservation.lastName}
              <span className="block text-[var(--surface-muted)]">{reservation.phone}</span>
              <span className="block text-[var(--surface-muted)]">{reservation.email}</span>
            </dd>
          </div>
        </dl>

        <p className="mt-12">
          <Link
            href={routes.services(locale)}
            className="text-xs uppercase tracking-[0.12em] underline underline-offset-4 hover:text-[var(--surface-accent)]"
          >
            {t('services.title')}
          </Link>
        </p>
      </div>
    </section>
  );
}
