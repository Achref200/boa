import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { isLocale } from '@/i18n/config';
import { getTranslator } from '@/i18n/translate';
import { getCart } from '@/modules/cart/service';
import { getCheckoutOptions } from '@/modules/orders/checkout-options';
import { getCurrentCustomer } from '@/modules/identity/session';
import { CheckoutForm } from '@/components/store/CheckoutForm';
import { routes } from '@/lib/routes';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return { title: getTranslator(locale)('checkout.title'), robots: { index: false, follow: false } };
}

export default async function CheckoutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const t = getTranslator(locale);
  const cart = await getCart(locale);

  // An empty cart has nothing to check out. Sending the customer back to the
  // cart page — which explains why — beats rendering a form that cannot submit.
  if (cart.lines.length === 0) redirect(routes.cart(locale));

  const [options, customer] = await Promise.all([getCheckoutOptions(locale), getCurrentCustomer()]);

  return (
    <section data-surface="paper" className="bg-[var(--surface-bg)] text-[var(--surface-fg)]">
      <div className="container-page py-12 lg:py-20">
        <h1 className="font-display text-[length:var(--text-3xl)]">{t('checkout.title')}</h1>

        <div className="mt-12">
          <CheckoutForm
            locale={locale}
            lines={cart.lines}
            subtotal={cart.subtotal}
            options={options}
            confirmationPath={routes.checkout(locale)}
            defaults={{
              email: customer?.email ?? '',
              firstName: customer?.firstName ?? '',
              lastName: customer?.lastName ?? '',
              phone: customer?.phone ?? '',
            }}
            labels={{
              stepContact: t('checkout.stepContact'),
              stepFulfilment: t('checkout.stepFulfilment'),
              stepPayment: t('checkout.stepPayment'),
              noteLegend: t('checkout.noteLegend'),
              email: t('checkout.email'),
              phone: t('checkout.phone'),
              phoneHint: t('checkout.phoneHint'),
              firstName: t('checkout.firstName'),
              lastName: t('checkout.lastName'),
              address1: t('checkout.address1'),
              address2: t('checkout.address2'),
              city: t('checkout.city'),
              governorate: t('checkout.governorate'),
              postalCode: t('checkout.postalCode'),
              note: t('checkout.note'),
              delivery: t('checkout.delivery'),
              handToHand: t('checkout.handToHand'),
              storePickup: t('checkout.storePickup'),
              choosePickupPoint: t('checkout.choosePickupPoint'),
              payment_cod: t('checkout.cashOnDelivery'),
              payment_cop: t('checkout.cashOnPickup'),
              payment_bank_transfer: t('checkout.bankTransfer'),
              payment_online: t('checkout.onlineGateway'),
              placeOrder: t('checkout.placeOrder'),
              placing: t('checkout.placing'),
              orderSummary: t('checkout.orderSummary'),
              noShippingForZone: t('checkout.noShippingForZone'),
              stockChanged: t('checkout.stockChanged'),
              acceptTerms: t('checkout.acceptTerms'),
              subtotal: t('cart.subtotal'),
              shipping: t('cart.shipping'),
              total: t('cart.total'),
              promoCode: t('cart.promoCode'),
              optional: t('common.optional'),
              generic: t('errors.generic'),
              validation: t('errors.validation'),
              rateLimited: t('errors.rateLimited'),
              outOfStock: t('errors.outOfStock', { name: '{name}' }),
              fieldInvalid: t('errors.fieldInvalid'),
            }}
          />
        </div>
      </div>
    </section>
  );
}
