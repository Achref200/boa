'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { cn } from '@/lib/cn';

/**
 * Destructive actions confirm in a native <dialog>, never with `window.confirm`
 * (which blocks the whole browser and cannot be styled or translated) and never
 * with a bare click. The dialog states what will happen in plain French, and the
 * confirming button is the one that carries the danger colour — so the safe
 * option is the one your eye lands on first.
 */
export function ConfirmButton({
  label,
  confirmTitle,
  confirmBody,
  confirmLabel,
  onConfirm,
  children,
  tone = 'critical',
  className,
}: {
  label: string;
  confirmTitle: string;
  confirmBody: string;
  confirmLabel: string;
  onConfirm: () => void | Promise<void>;
  children?: React.ReactNode;
  tone?: 'critical' | 'neutral';
  className?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={children ? label : undefined}
        className={cn(
          'inline-flex min-h-10 items-center gap-2 border px-3 text-xs transition-colors',
          tone === 'critical'
            ? 'border-[var(--surface-line)] text-[var(--surface-muted)] hover:border-[var(--color-critical)] hover:text-[var(--color-critical)]'
            : 'border-[var(--surface-line)] hover:border-[var(--surface-fg)]',
          className,
        )}
      >
        {children ?? label}
      </button>

      <dialog
        ref={dialogRef}
        onClose={() => setOpen(false)}
        data-surface="paper"
        className="m-auto w-[min(28rem,90vw)] rounded-md border border-[var(--surface-line)] bg-[var(--surface-raised)] p-0 text-[var(--surface-fg)] backdrop:bg-[rgb(30_31_33/0.5)]"
      >
        <div className="p-6">
          <h2 className="font-display text-lg">{confirmTitle}</h2>
          <p className="mt-3 text-sm leading-relaxed text-[var(--surface-muted)]">{confirmBody}</p>

          <div className="mt-8 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="min-h-11 rounded-md border border-[var(--surface-line)] px-5 text-xs uppercase tracking-[0.12em] hover:border-[var(--surface-fg)]"
            >
              Annuler
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await onConfirm();
                  setOpen(false);
                })
              }
              className="min-h-11 bg-[var(--color-critical)] px-5 text-xs uppercase tracking-[0.12em] text-white disabled:opacity-50"
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
