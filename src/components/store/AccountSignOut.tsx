'use client';

import { useTransition } from 'react';
import { signOutAction } from '@/modules/identity/actions';
import type { AppLocale } from '@/i18n/config';

export function AccountSignOut({ locale, label }: { locale: AppLocale; label: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => void signOutAction(locale))}
      className="min-h-11 text-xs uppercase tracking-[0.12em] text-[var(--surface-muted)] underline underline-offset-4 hover:text-[var(--surface-fg)] disabled:opacity-50"
    >
      {label}
    </button>
  );
}
