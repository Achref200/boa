'use client';

import { useEffect } from 'react';

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[admin]', error);
  }, [error]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-8">
      <h1 className="font-display text-[length:var(--text-xl)]">Une erreur est survenue</h1>
      <p className="mt-4 text-sm text-[var(--surface-muted)]">
        L’action n’a pas pu aboutir. Les données n’ont pas été modifiées : chaque écriture est
        transactionnelle.
      </p>
      <div className="mt-8 flex items-center gap-4">
        <button
          type="button"
          onClick={reset}
          className="min-h-11 bg-[var(--action-bg)] px-5 text-xs uppercase tracking-[0.12em] text-[var(--action-fg)]"
        >
          Réessayer
        </button>
        {error.digest ? (
          <span className="text-xs text-[var(--surface-muted)]">Référence : {error.digest}</span>
        ) : null}
      </div>
    </div>
  );
}
