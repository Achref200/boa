import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { isLocale } from '@/i18n/config';
import { getTranslator } from '@/i18n/translate';
import { getCurrentCustomer } from '@/modules/identity/session';
import { AccountSignOut } from '@/components/store/AccountSignOut';
import { routes } from '@/lib/routes';

export const dynamic = 'force-dynamic';

/**
 * The account area guards once, here, and every page below inherits it. The
 * customer id then comes from the session on each query — never from the URL.
 */
export default async function AccountLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const customer = await getCurrentCustomer();
  if (!customer) redirect(`${routes.signIn(locale)}?suite=${encodeURIComponent(routes.account(locale))}`);

  const t = getTranslator(locale);
  const links = [
    { href: routes.account(locale), label: t('account.overview') },
    { href: routes.accountOrders(locale), label: t('account.orders') },
    { href: routes.accountReservations(locale), label: t('account.reservations') },
    { href: routes.accountAddresses(locale), label: t('account.addresses') },
  ];

  return (
    <section data-surface="paper" className="bg-[var(--surface-bg)] text-[var(--surface-fg)]">
      <div className="container-page py-12 lg:py-20">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="lockup text-[var(--surface-accent)]">{t('account.title')}</p>
            <h1 className="font-display mt-4 text-[length:var(--text-2xl)]">
              {[customer.firstName, customer.lastName].filter(Boolean).join(' ') || customer.email}
            </h1>
          </div>
          <AccountSignOut locale={locale} label={t('account.signOut')} />
        </header>

        <div className="mt-10 grid gap-10 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-16">
          <nav aria-label={t('account.title')}>
            <ul className="flex flex-wrap gap-x-6 gap-y-2 lg:flex-col lg:gap-2">
              {links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="inline-flex min-h-11 items-center text-sm text-[var(--surface-muted)] hover:text-[var(--surface-fg)]"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div>{children}</div>
        </div>
      </div>
    </section>
  );
}
