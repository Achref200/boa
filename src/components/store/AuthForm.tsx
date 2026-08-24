'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { TextField } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { IconAlert } from '@/components/ui/icons';
import { signInAction, signUpAction } from '@/modules/identity/actions';
import type { AppLocale } from '@/i18n/config';

type Labels = {
  email: string;
  password: string;
  passwordHint: string;
  firstName: string;
  lastName: string;
  phone: string;
  optional: string;
  submitSignIn: string;
  submitSignUp: string;
  invalid: string;
  locked: string;
  rateLimited: string;
  generic: string;
  accountExists: string;
  passwordTooShort: string;
  noAccount: string;
  hasAccount: string;
  signIn: string;
  signUp: string;
};

/**
 * Sign-in and registration share one component because they share one failure
 * surface. The sign-in error is deliberately identical for "unknown account"
 * and "wrong password" — see `signInAction` for why.
 */
export function AuthForm({
  mode,
  locale,
  labels,
  redirectTo,
  otherHref,
}: {
  mode: 'signin' | 'signup';
  locale: AppLocale;
  labels: Labels;
  redirectTo: string;
  otherHref: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const data = new FormData(event.currentTarget);

    startTransition(async () => {
      const result =
        mode === 'signin'
          ? await signInAction({
              email: data.get('email'),
              password: data.get('password'),
              locale,
            })
          : await signUpAction({
              email: data.get('email'),
              password: data.get('password'),
              firstName: data.get('firstName'),
              lastName: data.get('lastName'),
              phone: data.get('phone') ?? '',
              locale,
            });

      if (result.ok) {
        router.replace(redirectTo);
        router.refresh();
        return;
      }

      setFieldErrors(result.fieldErrors ?? {});
      setError(
        result.code === 'account_locked'
          ? labels.locked
          : result.code === 'rate_limited'
            ? labels.rateLimited
            : result.code === 'conflict'
              ? labels.accountExists
              : result.code === 'validation_failed'
                ? (result.message === 'too_short' ? labels.passwordTooShort : labels.generic)
                : labels.invalid,
      );
    });
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6">
      {error ? (
        <p role="alert" className="flex items-start gap-3 rounded-md border border-[var(--color-critical)] px-4 py-3 text-sm">
          <IconAlert width={16} height={16} className="mt-0.5 shrink-0 text-[var(--color-critical)]" />
          {error}
        </p>
      ) : null}

      {mode === 'signup' ? (
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField id="firstName" label={labels.firstName} required autoComplete="given-name" />
          <TextField id="lastName" label={labels.lastName} required autoComplete="family-name" />
        </div>
      ) : null}

      <TextField id="email" label={labels.email} type="email" required autoComplete="email" />
      <TextField
        id="password"
        label={labels.password}
        type="password"
        required
        autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
        hint={mode === 'signup' ? labels.passwordHint : undefined}
        error={fieldErrors.password?.length ? labels.passwordTooShort : undefined}
      />

      {mode === 'signup' ? (
        <TextField id="phone" label={labels.phone} type="tel" optional optionalLabel={labels.optional} autoComplete="tel" />
      ) : null}

      <Button type="submit" size="lg" loading={pending} className="w-full">
        {mode === 'signin' ? labels.submitSignIn : labels.submitSignUp}
      </Button>

      <p className="text-center text-sm text-[var(--surface-muted)]">
        {mode === 'signin' ? labels.noAccount : labels.hasAccount}{' '}
        <Link href={otherHref} className="underline underline-offset-4 hover:text-[var(--surface-fg)]">
          {mode === 'signin' ? labels.signUp : labels.signIn}
        </Link>
      </p>
    </form>
  );
}
