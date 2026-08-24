'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { TextAreaField } from '@/components/ui/Field';
import { ConfirmButton } from './ConfirmButton';
import { IconAlert } from '@/components/ui/icons';
import {
  changeOrderStatusAction,
  changePaymentStatusAction,
  saveOrderNoteAction,
} from '@/modules/admin/actions/orders';
import { ORDER_STATUS_FR, PAYMENT_STATUS_FR } from '@/lib/labels';

/**
 * The order's whole workflow in one panel: what it can become next, what the
 * payment can become next, and the internal note.
 *
 * The buttons come from the server's own transition table, so the interface
 * cannot offer a move the server will reject — and cancelling asks for a reason
 * because a cancelled order without one is an unanswerable question a month
 * later.
 */
export function OrderWorkflow({
  orderId,
  status,
  paymentStatus,
  allowedStatuses,
  allowedPaymentStatuses,
  note,
  canRefund,
}: {
  orderId: string;
  status: string;
  paymentStatus: string;
  allowedStatuses: string[];
  allowedPaymentStatuses: string[];
  note: string;
  canRefund: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [noteValue, setNoteValue] = useState(note);
  const [reason, setReason] = useState('');

  const run = (fn: () => Promise<{ ok: boolean; message?: string }>) => {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (result.ok) router.refresh();
      else setError(result.message ?? 'Action impossible.');
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {error ? (
        <p role="alert" className="flex items-start gap-3 rounded-md border border-[var(--color-critical)] px-4 py-3 text-sm">
          <IconAlert width={16} height={16} className="mt-0.5 shrink-0 text-[var(--color-critical)]" />
          {error}
        </p>
      ) : null}

      <div>
        <h3 className="lockup mb-3 text-[10px] text-[var(--surface-muted)]">
          Statut · {ORDER_STATUS_FR[status] ?? status}
        </h3>
        <div className="flex flex-wrap gap-2">
          {allowedStatuses.length === 0 ? (
            <p className="text-sm text-[var(--surface-muted)]">
              Cette commande a atteint un état final.
            </p>
          ) : null}

          {allowedStatuses
            .filter((next) => next !== 'CANCELLED' && (next !== 'REFUNDED' || canRefund))
            .map((next) => (
              <Button
                key={next}
                type="button"
                intent="secondary"
                size="sm"
                loading={pending}
                onClick={() => run(() => changeOrderStatusAction({ orderId, status: next }))}
              >
                {ORDER_STATUS_FR[next] ?? next}
              </Button>
            ))}

          {allowedStatuses.includes('CANCELLED') ? (
            <ConfirmButton
              label="Annuler la commande"
              confirmTitle="Annuler cette commande ?"
              confirmBody="Le stock réservé est automatiquement remis en rayon et l’action est inscrite au journal. La commande reste consultable."
              confirmLabel="Annuler la commande"
              onConfirm={() =>
                new Promise<void>((resolve) => {
                  run(() =>
                    changeOrderStatusAction({ orderId, status: 'CANCELLED', reason: reason || undefined }).then(
                      (result) => {
                        resolve();
                        return result;
                      },
                    ),
                  );
                })
              }
            />
          ) : null}
        </div>

        {allowedStatuses.includes('CANCELLED') ? (
          <input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Motif d’annulation (facultatif)"
            aria-label="Motif d’annulation"
            className="mt-3 min-h-10 w-full border border-[var(--surface-field-line)] bg-[var(--surface-bg)] px-3 text-sm"
          />
        ) : null}
      </div>

      <div className="border-t border-[var(--surface-line)] pt-6">
        <h3 className="lockup mb-3 text-[10px] text-[var(--surface-muted)]">
          Paiement · {PAYMENT_STATUS_FR[paymentStatus] ?? paymentStatus}
        </h3>
        <div className="flex flex-wrap gap-2">
          {allowedPaymentStatuses
            .filter((next) => next !== 'REFUNDED' || canRefund)
            .map((next) => (
              <Button
                key={next}
                type="button"
                intent="secondary"
                size="sm"
                loading={pending}
                onClick={() => run(() => changePaymentStatusAction({ orderId, status: next }))}
              >
                {PAYMENT_STATUS_FR[next] ?? next}
              </Button>
            ))}
        </div>
        <p className="mt-3 text-xs text-[var(--surface-muted)]">
          Le paiement à la livraison se marque « réglée » une fois l’argent encaissé.
        </p>
      </div>

      <div className="border-t border-[var(--surface-line)] pt-6">
        <TextAreaField
          id="internalNote"
          label="Note interne"
          value={noteValue}
          onChange={(event) => setNoteValue(event.target.value)}
          hint="Visible uniquement par l’équipe BOA."
          rows={3}
        />
        <Button
          type="button"
          intent="secondary"
          size="sm"
          loading={pending}
          className="mt-3"
          onClick={() => run(() => saveOrderNoteAction({ orderId, note: noteValue }))}
        >
          Enregistrer la note
        </Button>
      </div>
    </div>
  );
}
