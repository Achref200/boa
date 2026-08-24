import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/config';
import { getTranslator } from '@/i18n/translate';
import { getCart } from '@/modules/cart/service';
import { routes } from '@/lib/routes';
import { formatMoney } from '@/lib/money';
import { CartLines } from '@/components/store/CartLines';
import { ButtonLink } from '@/components/ui/Button';
import { Petals } from '@/components/brand/Petals';
import { IconAlert } from '@/components/ui/icons';

/** The cart is per-visitor, so it can never be cached or statically rendered. */
export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return { title: getTranslator(locale)('cart.title'), robots: { index: false, follow: false } };
}

export default async function CartPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const t = getTranslator(locale);
  const cart = await getCart(locale);

  return (
    <section data-surface="paper" className="bg-[var(--surface-bg)] text-[var(--surface-fg)]">
      <div className="container-page py-12 lg:py-20">
        <h1 className="font-display text-[length:var(--text-3xl)]">{t('cart.title')}</h1>

        {/* Anything that changed since the customer added it is stated, not silently applied. */}
        {cart.issues.length > 0 ? (
          <ul className="mt-8 flex flex-col gap-2" role="status">
            {cart.issues.map((issue) => (
              <li
                key={`${issue.kind}-${issue.variantId}`}
                className="flex items-start gap-3 border border-[var(--color-caution)] px-4 py-3 text-sm"
              >
                <IconAlert width={16} height={16} className="mt-0.5 shrink-0 text-[var(--color-caution)]" />
                <span>
                  {issue.kind === 'quantity_reduced'
                    ? t('cart.quantityAdjusted', { name: issue.name })
                    : t('cart.removedUnavailable', { name: issue.name })}
                </span>
              </li>
            ))}
          </ul>
        ) : null}

        {cart.lines.length === 0 ? (
          <div className="mt-12 flex flex-col items-center gap-5 rounded-md border border-[var(--surface-line)] px-6 py-24 text-center">
            <Petals size={36} className="text-[var(--surface-accent)]" />
            <p className="font-display text-xl">{t('cart.empty')}</p>
            <p className="text-sm text-[var(--surface-muted)]">{t('cart.emptyHint')}</p>
            <ButtonLink href={routes.shop(locale)} className="mt-2">
              {t('cart.continueShopping')}
            </ButtonLink>
          </div>
        ) : (
          <div className="mt-12 grid gap-12 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-16">
            <CartLines
              lines={cart.lines}
              locale={locale}
              productBasePath={`/${locale}/produits`}
              labels={{
                quantity: t('common.quantity'),
                decrease: t('common.decrease'),
                increase: t('common.increase'),
                remove: t('common.remove'),
                error: t('errors.generic'),
                pending: t('product.imagePending'),
                format: t('shop.format'),
              }}
            />

            <aside className="lg:sticky lg:top-32 lg:self-start">
              <div className="rounded-md border border-[var(--surface-line)] p-6">
                <h2 className="lockup text-[var(--surface-muted)]">{t('checkout.orderSummary')}</h2>

                <dl className="mt-6 flex flex-col gap-3 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-[var(--surface-muted)]">{t('cart.subtotal')}</dt>
                    <dd className="tabular-nums">{formatMoney(cart.subtotal, locale)}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-[var(--surface-muted)]">{t('cart.shipping')}</dt>
                    <dd className="text-end text-xs text-[var(--surface-muted)]">
                      {t('cart.shippingLater')}
                    </dd>
                  </div>
                </dl>

                <div className="mt-6 flex justify-between gap-4 border-t border-[var(--surface-line)] pt-6">
                  <span className="font-display text-lg">{t('cart.total')}</span>
                  <span className="font-display text-lg tabular-nums">
                    {formatMoney(cart.subtotal, locale)}
                  </span>
                </div>

                <ButtonLink href={routes.checkout(locale)} size="lg" className="mt-8 w-full">
                  {t('cart.checkout')}
                </ButtonLink>

                <Link
                  href={routes.shop(locale)}
                  className="mt-4 block text-center text-xs uppercase tracking-[0.12em] text-[var(--surface-muted)] underline-offset-4 hover:text-[var(--surface-fg)] hover:underline"
                >
                  {t('cart.continueShopping')}
                </Link>
              </div>
            </aside>
          </div>
        )}
      </div>
    </section>
  );
}
