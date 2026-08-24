'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { ConfirmButton } from './ConfirmButton';
import { changeReservationStatusAction } from '@/modules/admin/actions/reservations';
import { RESERVATION_STATUS_FR } from '@/lib/labels';
import { cn } from '@/lib/cn';

/**
 * Inline status controls in the list, because the operational reality is a
 * phone call: "yes, we can take you" → confirm, "they never came" → no-show.
 * Making that a two-page round trip would guarantee the statuses go stale.
 */
export function ReservationActions({
  reservationId,
  allowed,
}: {
  reservationId: string;
  allowed: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(false);

  const run = (status: string, reason?: string) => {
    setError(false);
    startTransition(async () => {
      const result = await changeReservationStatusAction({ id: reservationId, status, reason });
      if (result.ok) router.refresh();
      else setError(true);
    });
  };

  if (allowed.length === 0) {
    return <span className="text-xs text-[var(--surface-muted)]">—</span>;
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {allowed
        .filter((status) => status !== 'CANCELLED')
        .map((status) => (
          <button
            key={status}
            type="button"
            disabled={pending}
            onClick={() => run(status)}
            className={cn(
              'min-h-9 rounded-md border border-[var(--surface-line)] px-2.5 text-xs transition-colors',
              'hover:border-[var(--surface-fg)] disabled:opacity-50',
            )}
          >
            {RESERVATION_STATUS_FR[status] ?? status}
          </button>
        ))}

      {allowed.includes('CANCELLED') ? (
        <ConfirmButton
          label="Annuler"
          confirmTitle="Annuler cette réservation ?"
          confirmBody="La place est immédiatement libérée pour un autre client. Prévenez la personne concernée : aucun message n’est envoyé automatiquement."
          confirmLabel="Annuler la réservation"
          onConfirm={() => run('CANCELLED')}
        />
      ) : null}

      {error ? (
        <span role="alert" className="text-xs text-[var(--color-critical)]">
          Action impossible
        </span>
      ) : null}
    </div>
  );
}
