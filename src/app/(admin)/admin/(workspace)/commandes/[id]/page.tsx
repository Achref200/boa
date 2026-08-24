import { notFound } from 'next/navigation';
import { requirePermission } from '@/modules/admin/guard';
import { allowedOrderTransitions, getOrderDetail, PAYMENT_TRANSITIONS, type OrderStatus } from '@/modules/admin/orders';
import { can } from '@/lib/permissions';
import { AdminPage, Panel } from '@/components/admin/AdminPage';
import { OrderWorkflow } from '@/components/admin/OrderWorkflow';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { MediaFrame } from '@/components/ui/MediaFrame';
import { formatMoney } from '@/lib/money';
import { formatDateTime } from '@/lib/datetime';
import {
  FULFILMENT_FR,
  ORDER_STATUS_FR,
  PAYMENT_METHOD_FR,
  PAYMENT_STATUS_FR,
  orderStatusTone,
} from '@/lib/labels';

export const dynamic = 'force-dynamic';

export default async function AdminOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requirePermission('order.read');
  const { id } = await params;
  const detail = await getOrderDetail(id);
  if (!detail) notFound();

  const { order, lines, events, payments } = detail;
  const allowedStatuses = can(admin, 'order.write')
    ? allowedOrderTransitions(
        order.status as OrderStatus,
        order.fulfilment as 'DELIVERY' | 'HAND_TO_HAND' | 'STORE_PICKUP',
      )
    : [];
  const allowedPayments = can(admin, 'order.write')
    ? [...(PAYMENT_TRANSITIONS[order.payment_status as keyof typeof PAYMENT_TRANSITIONS] ?? [])]
    : [];

  return (
    <AdminPage
      title={order.reference}
      description={`${order.first_name} ${order.last_name} · ${formatDateTime(order.placed_at)}`}
      wide
      actions={
        <div className="flex items-center gap-2">
          <StatusBadge tone={orderStatusTone(order.status)}>
            {ORDER_STATUS_FR[order.status] ?? order.status}
          </StatusBadge>
          <StatusBadge tone={order.payment_status === 'PAID' ? 'positive' : 'neutral'}>
            {PAYMENT_STATUS_FR[order.payment_status] ?? order.payment_status}
          </StatusBadge>
        </div>
      }
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-6">
          <Panel title="Articles">
            <ul className="flex flex-col">
              {lines.map((line) => (
                <li
                  key={line.id}
                  className="grid grid-cols-[3.5rem_minmax(0,1fr)_auto] items-center gap-4 border-b border-[var(--surface-line)] py-3 last:border-0"
                >
                  <MediaFrame
                    path={line.image_path}
                    alt=""
                    sizes="56px"
                    pendingLabel="—"
                    className="w-full"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm">{line.product_name}</p>
                    <p className="text-xs text-[var(--surface-muted)]">
                      {line.variant_format} · {line.sku} · × {line.quantity}
                    </p>
                  </div>
                  <p className="text-sm tabular-nums">{formatMoney(line.line_total, 'fr')}</p>
                </li>
              ))}
            </ul>

            <dl className="mt-5 flex flex-col gap-2 border-t border-[var(--surface-line)] pt-5 text-sm">
              <Row label="Sous-total" value={formatMoney(order.subtotal, 'fr')} />
              {order.discount_total !== '0.000' ? (
                <Row label={`Remise${order.discount_code ? ` (${order.discount_code})` : ''}`} value={`−${formatMoney(order.discount_total, 'fr')}`} />
              ) : null}
              <Row label="Livraison" value={formatMoney(order.shipping_total, 'fr')} />
              <div className="mt-2 flex justify-between border-t border-[var(--surface-line)] pt-3 text-base">
                <dt>Total</dt>
                <dd className="tabular-nums">{formatMoney(order.grand_total, 'fr')}</dd>
              </div>
            </dl>
          </Panel>

          <Panel title="Historique">
            <ol className="flex flex-col gap-3 text-sm">
              {events.map((event) => (
                <li key={String(event.id)} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="text-xs tabular-nums text-[var(--surface-muted)]">
                    {formatDateTime(event.createdAt)}
                  </span>
                  <span>{event.message ?? event.type}</span>
                  <span className="text-xs text-[var(--surface-muted)]">{event.actor ?? 'système'}</span>
                </li>
              ))}
            </ol>
          </Panel>
        </div>

        <div className="flex flex-col gap-6">
          <Panel title="Traitement">
            <OrderWorkflow
              orderId={order.id}
              status={order.status}
              paymentStatus={order.payment_status}
              allowedStatuses={allowedStatuses}
              allowedPaymentStatuses={allowedPayments}
              note={order.internal_note ?? ''}
              canRefund={can(admin, 'order.refund')}
            />
          </Panel>

          <Panel title="Réception">
            <p className="text-sm">{FULFILMENT_FR[order.fulfilment] ?? order.fulfilment}</p>
            <address className="mt-3 text-sm not-italic leading-relaxed text-[var(--surface-muted)]">
              <span className="block text-[var(--surface-fg)]">
                {order.first_name} {order.last_name}
              </span>
              {order.pickup_point_name ? (
                <span className="block">{order.pickup_point_name}</span>
              ) : (
                <>
                  {order.address_line1 ? <span className="block">{order.address_line1}</span> : null}
                  {order.address_line2 ? <span className="block">{order.address_line2}</span> : null}
                  <span className="block">
                    {[order.postal_code, order.city, order.governorate].filter(Boolean).join(' ')}
                  </span>
                </>
              )}
              <a href={`tel:${order.phone}`} className="mt-2 block hover:text-[var(--surface-fg)]">
                {order.phone}
              </a>
              <a href={`mailto:${order.email}`} className="block hover:text-[var(--surface-fg)]">
                {order.email}
              </a>
            </address>

            {order.customer_note ? (
              <p className="mt-4 border-t border-[var(--surface-line)] pt-4 text-sm">
                <span className="lockup block text-[10px] text-[var(--surface-muted)]">Note du client</span>
                <span className="mt-2 block">{order.customer_note}</span>
              </p>
            ) : null}
          </Panel>

          <Panel title="Paiement">
            <p className="text-sm">{PAYMENT_METHOD_FR[order.payment_method] ?? order.payment_method}</p>
            <ul className="mt-3 flex flex-col gap-2 text-xs text-[var(--surface-muted)]">
              {payments.map((payment) => (
                <li key={payment.id} className="flex justify-between gap-4">
                  <span>{payment.provider}</span>
                  <span className="tabular-nums">{formatMoney(payment.amount, 'fr')}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-[var(--surface-muted)]">
              Aucune donnée de carte bancaire n’est stockée par BOA.
            </p>
          </Panel>
        </div>
      </div>
    </AdminPage>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-[var(--surface-muted)]">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
