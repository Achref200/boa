'use client';

import { useTransition } from 'react';
import { adminSignOutAction } from '@/modules/identity/actions';

export function AdminSignOutButton() {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => void adminSignOutAction())}
      className="text-xs uppercase tracking-[0.12em] text-[var(--surface-muted)] underline underline-offset-4 hover:text-[var(--surface-fg)] disabled:opacity-50"
    >
      Se déconnecter
    </button>
  );
}
