import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/config';
import { getTranslator } from '@/i18n/translate';
import { getOrderByReference } from '@/modules/orders/service';
import { OrderDetailView } from '@/components/store/OrderDetailView';
import { TextField } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { IconAlert } from '@/components/ui/icons';
import { routes } from '@/lib/routes';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return { title: getTranslator(locale)('order.trackTitle'), robots: { index: false, follow: false } };
}

/**
 * A plain GET form, no JavaScript required.
 *
 * Reference *and* email are both needed: the reference alone is a sequential
 * number, and BOA-25-0001 … BOA-25-0400 would otherwise enumerate every
 * customer's address and phone number. The lookup is deliberately not
 * rate-limited by IP alone — it also requires knowing the email — but a wrong
 * pair returns the same message as a missing order, so it cannot be used to
 * test whether an email has ordered.
 */
export default async function OrderTrackingPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ ref?: string; email?: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const query = await searchParams;
  const t = getTranslator(locale);

  const submitted = Boolean(query.ref && query.email);
  const order = submitted ? await getOrderByReference(query.ref!, query.email!) : null;

  return (
    <section data-surface="paper" className="bg-[var(--surface-bg)] text-[var(--surface-fg)]">
      <div className="container-page py-12 lg:py-20">
        <div className="max-w-[var(--container-reading)]">
          <h1 className="font-display text-[length:var(--text-3xl)]">{t('order.trackTitle')}</h1>
          <p className="mt-4 text-sm text-[var(--surface-muted)]">{t('order.trackHint')}</p>

          <form method="get" action={routes.orderTracking(locale)} className="mt-8 grid gap-5 sm:grid-cols-2">
            <TextField
              id="ref"
              name="ref"
              label={t('order.reference')}
              defaultValue={query.ref ?? ''}
              required
              autoCapitalize="characters"
              placeholder="BOA-25-0001"
            />
            <TextField
              id="email"
              name="email"
              type="email"
              label={t('checkout.email')}
              defaultValue={query.email ?? ''}
              required
              autoComplete="email"
            />
            <Button type="submit" className="sm:col-span-2 sm:justify-self-start">
              {t('common.search')}
            </Button>
          </form>

          {submitted && !order ? (
            <p
              role="status"
              className="mt-8 flex items-start gap-3 border border-[var(--color-caution)] px-4 py-3 text-sm"
            >
              <IconAlert width={16} height={16} className="mt-0.5 shrink-0 text-[var(--color-caution)]" />
              {t('order.notFound')}
            </p>
          ) : null}
        </div>

        {order ? (
          <div className="mt-16">
            <OrderDetailView order={order} locale={locale} />
          </div>
        ) : null}
      </div>
    </section>
  );
}
