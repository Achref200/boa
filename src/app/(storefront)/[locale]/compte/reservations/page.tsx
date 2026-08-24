import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/config';
import { getTranslator } from '@/i18n/translate';
import { getCurrentCustomer } from '@/modules/identity/session';
import { getCustomerReservations } from '@/modules/identity/account';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { CancelReservationButton } from '@/components/store/CancelReservationButton';
import { formatLongDateTime } from '@/lib/datetime';

export const dynamic = 'force-dynamic';

export default async function AccountReservationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const customer = await getCurrentCustomer();
  if (!customer) notFound();

  const t = getTranslator(locale);
  const reservations = await getCustomerReservations(customer.id);

  return (
    <div>
      <h2 className="font-display text-[length:var(--text-xl)]">{t('account.reservations')}</h2>

      {reservations.length === 0 ? (
        <p className="mt-6 text-sm text-[var(--surface-muted)]">{t('account.noReservations')}</p>
      ) : (
        <ul className="mt-8 border-t border-[var(--surface-line)]">
          {reservations.map((reservation) => {
            const cancellable =
              reservation.startsAt > new Date() &&
              (reservation.status === 'PENDING' || reservation.status === 'CONFIRMED');

            return (
              <li
                key={reservation.id}
                className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-[var(--surface-line)] py-5"
              >
                <div className="min-w-0">
                  <p className="text-sm">{reservation.serviceName}</p>
                  <p className="text-xs text-[var(--surface-muted)]">
                    {formatLongDateTime(reservation.startsAt, locale)}
                    {reservation.locationName ? ` · ${reservation.locationName}` : ''}
                  </p>
                </div>

                <StatusBadge
                  tone={
                    reservation.status === 'CONFIRMED' || reservation.status === 'COMPLETED'
                      ? 'positive'
                      : reservation.status === 'PENDING'
                        ? 'caution'
                        : 'critical'
                  }
                >
                  {t(`reservation.statuses.${reservation.status}` as 'reservation.statuses.PENDING')}
                </StatusBadge>

                <span className="ms-auto text-xs tabular-nums text-[var(--surface-muted)]">
                  {reservation.reference}
                </span>

                {cancellable ? (
                  <CancelReservationButton
                    reservationId={reservation.id}
                    labels={{
                      cancel: t('reservation.cancel'),
                      confirmTitle: t('reservation.cancel'),
                      confirmBody: t('reservation.cancelled'),
                      error: t('errors.generic'),
                    }}
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
