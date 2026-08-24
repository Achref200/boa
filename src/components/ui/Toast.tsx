'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { IconAlert, IconCheck, IconClose } from './icons';
import { cn } from '@/lib/cn';

/**
 * Toasts announce results of actions the customer took (added to cart, code
 * applied, slot taken). They are never used for marketing, and never appear
 * without a user action.
 *
 * The region is a polite live region so a screen reader hears the message
 * without losing the caret; errors are assertive because they change what the
 * user should do next.
 */
type ToastTone = 'success' | 'error' | 'info';
type Toast = { id: number; tone: ToastTone; message: string };

const ToastContext = createContext<((message: string, tone?: ToastTone) => void) | null>(null);

export function useToast() {
  const push = useContext(ToastContext);
  if (!push) throw new Error('useToast must be used inside <ToastProvider>');
  return push;
}

let nextId = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((message: string, tone: ToastTone = 'success') => {
    const id = (nextId += 1);
    setToasts((current) => [...current.slice(-2), { id, tone, message }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, tone === 'error' ? 7000 : 4000);
  }, []);

  const value = useMemo(() => push, [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={(id) => setToasts((c) => c.filter((t) => t.id !== id))} />
    </ToastContext.Provider>
  );
}

function ToastViewport({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return (
    <>
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-inline-0 bottom-0 z-[80] flex flex-col items-center gap-2 p-4 sm:items-end"
        style={{ insetInlineStart: 0, insetInlineEnd: 0 }}
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            data-surface="ink"
            className={cn(
              'pointer-events-auto flex w-full max-w-sm items-start gap-3 border px-4 py-3 text-sm',
              'bg-[var(--surface-bg)] text-[var(--surface-fg)] shadow-[var(--shadow-overlay)]',
              toast.tone === 'error'
                ? 'border-[var(--color-critical)]'
                : 'border-[var(--surface-line)]',
            )}
          >
            <span className="mt-0.5 shrink-0 text-[var(--surface-accent)]">
              {toast.tone === 'error' ? <IconAlert width={16} height={16} /> : <IconCheck width={16} height={16} />}
            </span>
            <p className="flex-1 leading-snug">{toast.message}</p>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              className="shrink-0 text-[var(--surface-muted)] hover:text-[var(--surface-fg)]"
              aria-label="Fermer"
            >
              <IconClose width={16} height={16} />
            </button>
          </div>
        ))}
      </div>
    </>
  );
}

/** Kept for layouts that mount the region separately from the provider. */
export function ToastRegion() {
  return null;
}
