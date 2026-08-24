'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { TextField } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { IconAlert } from '@/components/ui/icons';
import { adminSignInAction } from '@/modules/identity/actions';

export function AdminSignInForm({ redirectTo }: { redirectTo: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const data = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await adminSignInAction({
        email: data.get('email'),
        password: data.get('password'),
      });

      if (result.ok) {
        router.replace(redirectTo);
        router.refresh();
        return;
      }

      // One message for every failure mode. Distinguishing "unknown account"
      // from "wrong password" would turn this form into an account oracle.
      setError(
        result.code === 'rate_limited'
          ? 'Trop de tentatives. Réessayez dans quelques minutes.'
          : result.code === 'account_locked'
            ? 'Compte temporairement bloqué.'
            : 'E-mail ou mot de passe incorrect.',
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

      <TextField id="email" label="E-mail" type="email" autoComplete="username" required autoFocus />
      <TextField id="password" label="Mot de passe" type="password" autoComplete="current-password" required />

      <Button type="submit" size="lg" loading={pending} className="w-full">
        Se connecter
      </Button>
    </form>
  );
}
