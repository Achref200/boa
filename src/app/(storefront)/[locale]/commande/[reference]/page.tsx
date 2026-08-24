import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { isLocale } from '@/i18n/config';
import { getTranslator } from '@/i18n/translate';
import { getOrderByReferenceUnsafe } from '@/modules/orders/service';
import { LAST_ORDER_COOKIE } from '@/modules/orders/constants';
import { OrderDetailView } from '@/components/store/OrderDetailView';
import { SectionSeam } from '@/components/brand/Petals';
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
    title: getTranslator(locale)('order.confirmedTitle'),
    robots: { index: false, follow: false },
  };
}

/**
 * Reachable only with the httpOnly receipt cookie written at checkout. Without
 * it the reference alone would expose a stranger's name, address and phone
 * number, so an unmatched visit is sent to the tracking form, which asks for
 * the order's email before showing anything.
 */
export default async function OrderConfirmationPage({
  params,
}: {
  params: Promise<{ locale: string; reference: string }>;
}) {
  const { locale, reference } = await params;
  if (!isLocale(locale)) notFound();

  const receipt = (await cookies()).get(LAST_ORDER_COOKIE)?.value;
  if (!receipt || receipt !== reference) redirect(routes.orderTracking(locale));

  const order = await getOrderByReferenceUnsafe(reference);
  if (!order) notFound();

  const t = getTranslator(locale);

  return (
    <section data-surface="paper" className="bg-[var(--surface-bg)] text-[var(--surface-fg)]">
      <div className="container-page py-16 lg:py-24">
        <div className="max-w-[var(--container-reading)]">
          <p className="lockup text-[var(--surface-accent)]">{t('order.reference')} {order.reference}</p>
          <h1 className="font-display mt-5 text-[length:var(--text-3xl)]">
            {t('order.confirmedTitle')}
          </h1>
          <p className="mt-5 leading-relaxed text-[var(--surface-muted)]">
            {t('order.confirmedLead', { name: order.firstName, reference: order.reference })}
          </p>
          <p className="mt-2 text-sm text-[var(--surface-muted)]">{t('order.whatNext')}</p>
        </div>

        <div className="my-12">
          <SectionSeam />
        </div>

        <OrderDetailView order={order} locale={locale} />

        <div className="mt-12 flex flex-wrap gap-6">
          <Link
            href={routes.shop(locale)}
            className="text-xs uppercase tracking-[0.12em] underline underline-offset-4 hover:text-[var(--surface-accent)]"
          >
            {t('cart.continueShopping')}
          </Link>
          <Link
            href={routes.orderTracking(locale)}
            className="text-xs uppercase tracking-[0.12em] text-[var(--surface-muted)] underline underline-offset-4 hover:text-[var(--surface-fg)]"
          >
            {t('order.trackTitle')}
          </Link>
        </div>
      </div>
    </section>
  );
}
