import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { isLocale } from '@/i18n/config';
import { getTranslator } from '@/i18n/translate';
import { getCurrentCustomer } from '@/modules/identity/session';
import { AuthForm } from '@/components/store/AuthForm';
import { routes } from '@/lib/routes';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return { title: getTranslator(locale)('auth.signIn'), robots: { index: false, follow: true } };
}

export default async function SignInPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ suite?: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  if (await getCurrentCustomer()) redirect(routes.account(locale));

  const { suite } = await searchParams;
  const t = getTranslator(locale);

  // Only same-site paths are accepted as a post-login destination: an open
  // redirect here would let a phishing link bounce a signed-in customer to an
  // attacker's page carrying BOA's name.
  const redirectTo = suite && suite.startsWith(`/${locale}/`) ? suite : routes.account(locale);

  return (
    <section data-surface="paper" className="bg-[var(--surface-bg)] text-[var(--surface-fg)]">
      <div className="container-page grid place-items-center py-16 lg:py-28">
        <div className="w-full max-w-sm">
          <h1 className="font-display text-center text-[length:var(--text-2xl)]">{t('auth.signIn')}</h1>

          <div className="mt-10">
            <AuthForm
              mode="signin"
              locale={locale}
              redirectTo={redirectTo}
              otherHref={routes.signUp(locale)}
              labels={{
                email: t('checkout.email'),
                password: t('auth.password'),
                passwordHint: t('auth.passwordHint'),
                firstName: t('checkout.firstName'),
                lastName: t('checkout.lastName'),
                phone: t('checkout.phone'),
                optional: t('common.optional'),
                submitSignIn: t('auth.signIn'),
                submitSignUp: t('auth.signUp'),
                invalid: t('auth.invalid'),
                locked: t('auth.locked'),
                rateLimited: t('errors.rateLimited'),
                generic: t('errors.generic'),
                accountExists: t('auth.hasAccount'),
                passwordTooShort: t('auth.passwordHint'),
                noAccount: t('auth.noAccount'),
                hasAccount: t('auth.hasAccount'),
                signIn: t('auth.signIn'),
                signUp: t('auth.signUp'),
              }}
            />
          </div>

          <p className="mt-8 text-center text-xs text-[var(--surface-muted)]">
            {t('auth.guestCheckout')} —{' '}
            <Link href={routes.cart(locale)} className="underline underline-offset-4">
              {t('cart.title')}
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}
