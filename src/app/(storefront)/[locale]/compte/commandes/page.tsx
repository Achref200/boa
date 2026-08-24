import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/config';
import { getTranslator } from '@/i18n/translate';
import { getCurrentCustomer } from '@/modules/identity/session';
import { getCustomerOrders } from '@/modules/identity/account';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Pagination } from '@/components/ui/Pagination';
import { formatMoney } from '@/lib/money';
import { formatDateTime } from '@/lib/datetime';
import { routes } from '@/lib/routes';

export const dynamic = 'force-dynamic';

export default async function AccountOrdersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const customer = await getCurrentCustomer();
  if (!customer) notFound();

  const t = getTranslator(locale);
  const { page } = await searchParams;
  const orders = await getCustomerOrders(customer.id, Number.parseInt(page ?? '1', 10) || 1);

  return (
    <div>
      <h2 className="font-display text-[length:var(--text-xl)]">{t('account.orders')}</h2>

      {orders.rows.length === 0 ? (
        <p className="mt-6 text-sm text-[var(--surface-muted)]">{t('account.noOrders')}</p>
      ) : (
        <ul className="mt-8 border-t border-[var(--surface-line)]">
          {orders.rows.map((order) => (
            <li key={order.id} className="border-b border-[var(--surface-line)]">
              <Link
                href={`${routes.accountOrders(locale)}/${order.reference}`}
                className="flex flex-wrap items-center gap-x-6 gap-y-2 py-5 hover:text-[var(--surface-accent)]"
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

      <Pagination
        page={orders.page}
        pageCount={orders.pageCount}
        hrefFor={(next) =>
          next > 1 ? `${routes.accountOrders(locale)}?page=${next}` : routes.accountOrders(locale)
        }
        labels={{
          previous: t('common.previous'),
          next: t('common.next'),
          nav: t('account.orders'),
          page: t('account.orders'),
        }}
      />
    </div>
  );
}
