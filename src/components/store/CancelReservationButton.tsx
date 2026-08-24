'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { cancelReservationAction } from '@/modules/reservations/actions';

/**
 * Cancelling frees the seat immediately, so it asks once before doing it. The
 * confirmation is a native <dialog> in the admin; here a two-step button is
 * enough — the action is reversible by booking again, and a modal on a phone
 * for a single reversible action is friction without benefit.
 */
export function CancelReservationButton({
  reservationId,
  labels,
}: {
  reservationId: string;
  labels: { cancel: string; confirmTitle: string; confirmBody: string; error: string };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [armed, setArmed] = useState(false);
  const [error, setError] = useState(false);

  const cancel = () => {
    setError(false);
    startTransition(async () => {
      const result = await cancelReservationAction({ reservationId });
      if (result.ok) router.refresh();
      else setError(true);
    });
  };

  if (!armed) {
    return (
      <button
        type="button"
        onClick={() => setArmed(true)}
        className="min-h-11 text-xs uppercase tracking-[0.12em] text-[var(--surface-muted)] underline underline-offset-4 hover:text-[var(--color-critical)]"
      >
        {labels.cancel}
      </button>
    );
  }

  return (
    <span className="flex items-center gap-3">
      <button
        type="button"
        disabled={pending}
        onClick={cancel}
        className="min-h-11 rounded-full border border-[var(--color-critical)] px-3 text-sm font-semibold text-[var(--color-critical)] disabled:opacity-50"
      >
        {labels.confirmTitle}
      </button>
      <button
        type="button"
        onClick={() => setArmed(false)}
        className="min-h-11 text-xs text-[var(--surface-muted)] underline underline-offset-4"
      >
        ✕
      </button>
      {error ? (
        <span role="alert" className="text-xs text-[var(--color-critical)]">
          {labels.error}
        </span>
      ) : null}
    </span>
  );
}
