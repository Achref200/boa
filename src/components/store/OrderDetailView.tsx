import type { AppLocale } from '@/i18n/config';
import { getTranslator } from '@/i18n/translate';
import { formatMoney } from '@/lib/money';
import { formatDateTime } from '@/lib/datetime';
import { MediaFrame } from '@/components/ui/MediaFrame';
import { StatusBadge } from '@/components/ui/StatusBadge';
import type { OrderDetail } from '@/modules/orders/service';

const ORDER_STATUS_KEY = {
  PENDING: 'order.statuses.PENDING',
  CONFIRMED: 'order.statuses.CONFIRMED',
  PREPARING: 'order.statuses.PREPARING',
  SHIPPED: 'order.statuses.SHIPPED',
  READY_FOR_PICKUP: 'order.statuses.READY_FOR_PICKUP',
  COMPLETED: 'order.statuses.COMPLETED',
  CANCELLED: 'order.statuses.CANCELLED',
  REFUNDED: 'order.statuses.REFUNDED',
} as const;

const PAYMENT_STATUS_KEY = {
  UNPAID: 'order.payments.UNPAID',
  AUTHORIZED: 'order.payments.AUTHORIZED',
  PAID: 'order.payments.PAID',
  FAILED: 'order.payments.FAILED',
  REFUNDED: 'order.payments.REFUNDED',
  CANCELLED: 'order.payments.CANCELLED',
} as const;

/**
 * One presentation of an order, reused by the confirmation page, the tracking
 * page and the account area. Every value comes from the order's own snapshot
 * columns, so an order placed a year ago still shows the name and price the
 * customer actually paid.
 */
export function OrderDetailView({ order, locale }: { order: OrderDetail; locale: AppLocale }) {
  const t = getTranslator(locale);
  const statusKey = ORDER_STATUS_KEY[order.status as keyof typeof ORDER_STATUS_KEY];
  const paymentKey = PAYMENT_STATUS_KEY[order.paymentStatus as keyof typeof PAYMENT_STATUS_KEY];


  return (
    <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-16">
      <div>
        <dl className="grid grid-cols-2 gap-6 border-y border-[var(--surface-line)] py-6 text-sm sm:grid-cols-4">
          <div>
            <dt className="lockup text-[var(--surface-muted)]">{t('order.reference')}</dt>
            <dd className="mt-2 font-medium tabular-nums">{order.reference}</dd>
          </div>
          <div>
            <dt className="lockup text-[var(--surface-muted)]">{t('order.placedOn')}</dt>
            <dd className="mt-2">{formatDateTime(order.placedAt, locale)}</dd>
          </div>
          <div>
            <dt className="lockup text-[var(--surface-muted)]">{t('order.status')}</dt>
            <dd className="mt-2">
              <StatusBadge tone={statusTone(order.status)}>{t(statusKey)}</StatusBadge>
            </dd>
          </div>
          <div>
            <dt className="lockup text-[var(--surface-muted)]">{t('order.paymentStatus')}</dt>
            <dd className="mt-2">
              <StatusBadge tone={order.paymentStatus === 'PAID' ? 'positive' : 'neutral'}>
                {t(paymentKey)}
              </StatusBadge>
            </dd>
          </div>
        </dl>

        <h2 className="lockup mt-10 text-[var(--surface-muted)]">{t('order.items')}</h2>
        <ul className="mt-6 border-t border-[var(--surface-line)]">
          {order.lines.map((line) => (
            <li
              key={line.id}
              className="grid grid-cols-[4rem_minmax(0,1fr)_auto] items-center gap-4 border-b border-[var(--surface-line)] py-4"
            >
              <MediaFrame
                path={line.imagePath}
                alt=""
                sizes="64px"
                pendingLabel={t('product.imagePending')}
                className="w-full"
              />
              <div className="min-w-0">
                <p className="truncate text-sm">{line.productName}</p>
                <p className="text-xs text-[var(--surface-muted)]">
                  {line.variantFormat} · {line.sku} · × {line.quantity}
                </p>
              </div>
              <p className="text-sm tabular-nums">{formatMoney(line.lineTotal, locale)}</p>
            </li>
          ))}
        </ul>
      </div>

      <aside className="flex flex-col gap-8">
        <div className="rounded-md border border-[var(--surface-line)] p-6">
          <dl className="flex flex-col gap-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--surface-muted)]">{t('cart.subtotal')}</dt>
              <dd className="tabular-nums">{formatMoney(order.subtotal, locale)}</dd>
            </div>
            {order.discountTotal !== '0.000' ? (
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--surface-muted)]">{t('cart.discount')}</dt>
                <dd className="tabular-nums">−{formatMoney(order.discountTotal, locale)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--surface-muted)]">{t('cart.shipping')}</dt>
              <dd className="tabular-nums">{formatMoney(order.shippingTotal, locale)}</dd>
            </div>
          </dl>
          <div className="mt-6 flex justify-between gap-4 border-t border-[var(--surface-line)] pt-6">
            <span className="font-display text-lg">{t('cart.total')}</span>
            <span className="font-display text-lg tabular-nums">
              {formatMoney(order.grandTotal, locale)}
            </span>
          </div>
        </div>

        <div className="rounded-md border border-[var(--surface-line)] p-6 text-sm leading-relaxed">
          <h2 className="lockup text-[var(--surface-muted)]">
            {order.pickupPointName ? t('order.pickupAt') : t('order.deliveryTo')}
          </h2>
          <address className="mt-4 not-italic">
            <span className="block">
              {order.firstName} {order.lastName}
            </span>
            {order.pickupPointName ? (
              <span className="block">{order.pickupPointName}</span>
            ) : (
              <>
                {order.addressLine1 ? <span className="block">{order.addressLine1}</span> : null}
                {order.addressLine2 ? <span className="block">{order.addressLine2}</span> : null}
                <span className="block">
                  {[order.postalCode, order.city, order.governorate].filter(Boolean).join(' ')}
                </span>
              </>
            )}
            <span className="mt-2 block text-[var(--surface-muted)]">{order.phone}</span>
            <span className="block text-[var(--surface-muted)]">{order.email}</span>
          </address>

          {order.customerNote ? (
            <p className="mt-4 border-t border-[var(--surface-line)] pt-4 text-[var(--surface-muted)]">
              {order.customerNote}
            </p>
          ) : null}
        </div>
      </aside>
    </div>
  );
}

function statusTone(status: string): 'positive' | 'caution' | 'critical' | 'neutral' {
  switch (status) {
    case 'COMPLETED':
    case 'SHIPPED':
    case 'READY_FOR_PICKUP':
      return 'positive';
    case 'PENDING':
      return 'caution';
    case 'CANCELLED':
    case 'REFUNDED':
      return 'critical';
    default:
      return 'neutral';
  }
}
