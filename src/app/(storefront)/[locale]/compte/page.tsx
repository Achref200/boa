import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/config';
import { getTranslator } from '@/i18n/translate';
import { getCurrentCustomer } from '@/modules/identity/session';
import { getCustomerOrders, getCustomerReservations } from '@/modules/identity/account';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { formatMoney } from '@/lib/money';
import { formatDateTime } from '@/lib/datetime';
import { routes } from '@/lib/routes';

export const dynamic = 'force-dynamic';

export default async function AccountOverviewPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const customer = await getCurrentCustomer();
  if (!customer) notFound();

  const t = getTranslator(locale);
  const [orders, reservations] = await Promise.all([
    getCustomerOrders(customer.id, 1),
    getCustomerReservations(customer.id),
  ]);

  const upcoming = reservations.filter(
    (reservation) =>
      reservation.startsAt >= new Date() &&
      (reservation.status === 'PENDING' || reservation.status === 'CONFIRMED'),
  );

  return (
    <div className="flex flex-col gap-12">
      <section>
        <h2 className="lockup text-[var(--surface-muted)]">{t('account.orders')}</h2>
        {orders.rows.length === 0 ? (
          <p className="mt-5 text-sm text-[var(--surface-muted)]">{t('account.noOrders')}</p>
        ) : (
          <ul className="mt-5 border-t border-[var(--surface-line)]">
            {orders.rows.slice(0, 4).map((order) => (
              <li key={order.id} className="border-b border-[var(--surface-line)]">
                <Link
                  href={`${routes.accountOrders(locale)}/${order.reference}`}
                  className="flex flex-wrap items-center gap-x-6 gap-y-2 py-4 hover:text-[var(--surface-accent)]"
                >
                  <span className="tabular-nums">{order.reference}</span>
                  <span className="text-xs text-[var(--surface-muted)]">
                    {formatDateTime(order.placedAt, locale)}
                  </span>
                  <StatusBadge tone={order.status === 'PENDING' ? 'caution' : 'neutral'}>
                    {t(`order.statuses.${order.status}` as 'order.statuses.PENDING')}
                  </StatusBadge>
                  <span className="ms-auto tabular-nums">{formatMoney(order.grandTotal, locale)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="lockup text-[var(--surface-muted)]">{t('account.reservations')}</h2>
        {upcoming.length === 0 ? (
          <p className="mt-5 text-sm text-[var(--surface-muted)]">{t('account.noReservations')}</p>
        ) : (
          <ul className="mt-5 border-t border-[var(--surface-line)]">
            {upcoming.slice(0, 4).map((reservation) => (
              <li
                key={reservation.id}
                className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-[var(--surface-line)] py-4"
              >
                <span className="tabular-nums">{formatDateTime(reservation.startsAt, locale)}</span>
                <span>{reservation.serviceName}</span>
                <StatusBadge tone={reservation.status === 'CONFIRMED' ? 'positive' : 'caution'}>
                  {t(`reservation.statuses.${reservation.status}` as 'reservation.statuses.PENDING')}
                </StatusBadge>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
