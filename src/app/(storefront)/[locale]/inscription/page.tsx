import type { Metadata } from 'next';
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
  return { title: getTranslator(locale)('auth.signUp'), robots: { index: false, follow: true } };
}

export default async function SignUpPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  if (await getCurrentCustomer()) redirect(routes.account(locale));

  const t = getTranslator(locale);

  return (
    <section data-surface="paper" className="bg-[var(--surface-bg)] text-[var(--surface-fg)]">
      <div className="container-page grid place-items-center py-16 lg:py-28">
        <div className="w-full max-w-sm">
          <h1 className="font-display text-center text-[length:var(--text-2xl)]">{t('auth.signUp')}</h1>
          <p className="mt-4 text-center text-sm text-[var(--surface-muted)]">
            {t('account.orders')} · {t('account.reservations')} · {t('account.addresses')}
          </p>

          <div className="mt-10">
            <AuthForm
              mode="signup"
              locale={locale}
              redirectTo={routes.account(locale)}
              otherHref={routes.signIn(locale)}
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
        </div>
      </div>
    </section>
  );
}
