import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/config';
import { getCurrentCustomer } from '@/modules/identity/session';
import { getCustomerOrder } from '@/modules/identity/account';
import { OrderDetailView } from '@/components/store/OrderDetailView';
import type { OrderDetail } from '@/modules/orders/service';

export const dynamic = 'force-dynamic';

/**
 * The order is fetched by (customerId, reference). A reference belonging to
 * someone else simply does not match, so there is no separate ownership check
 * to forget.
 */
export default async function AccountOrderPage({
  params,
}: {
  params: Promise<{ locale: string; reference: string }>;
}) {
  const { locale, reference } = await params;
  if (!isLocale(locale)) notFound();
  const customer = await getCurrentCustomer();
  if (!customer) notFound();

  const result = await getCustomerOrder(customer.id, reference.toUpperCase());
  if (!result) notFound();

  const { order, lines } = result;
  const detail: OrderDetail = {
    id: order.id,
    reference: order.reference,
    status: order.status,
    paymentStatus: order.payment_status,
    paymentMethod: order.payment_method,
    fulfilment: order.fulfilment,
    placedAt: order.placed_at,
    subtotal: order.subtotal,
    discountTotal: order.discount_total,
    shippingTotal: order.shipping_total,
    grandTotal: order.grand_total,
    email: order.email,
    phone: order.phone,
    firstName: order.first_name,
    lastName: order.last_name,
    addressLine1: order.address_line1,
    addressLine2: order.address_line2,
    city: order.city,
    governorate: order.governorate,
    postalCode: order.postal_code,
    pickupPointName: order.pickup_point_name,
    customerNote: order.customer_note,
    lines,
  };

  return <OrderDetailView order={detail} locale={locale} />;
}
