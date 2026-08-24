'use client';

import { useEffect } from 'react';
import { Petals } from '@/components/brand/Petals';

/**
 * The last line of defence. It never renders the error's message: in production
 * that string can carry a query, a column name or a connection detail, and a
 * customer can do nothing with it anyway. The digest is shown because it is the
 * one thing that lets BOA's developer find this exact failure in the logs.
 */
export default function StorefrontError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[storefront]', error);
  }, [error]);

  return (
    <section data-surface="paper" className="bg-[var(--surface-bg)] text-[var(--surface-fg)]">
      <div className="container-page grid min-h-[60dvh] place-items-center py-20 text-center">
        <div className="flex max-w-md flex-col items-center gap-6">
          <Petals size={40} className="text-[var(--surface-accent)]" />
          <h1 className="font-display text-[length:var(--text-2xl)]">
            Service momentanément indisponible
          </h1>
          <p className="text-sm leading-relaxed text-[var(--surface-muted)]">
            Une erreur est survenue. Réessayez dans un instant.
            <span className="mt-1 block">Something went wrong. Please try again.</span>
          </p>
          <button
            type="button"
            onClick={reset}
            className="mt-2 inline-flex min-h-11 items-center bg-[var(--action-bg)] px-6 text-xs uppercase tracking-[0.14em] text-[var(--action-fg)]"
          >
            Réessayer
          </button>
          {error.digest ? (
            <p className="text-[11px] text-[var(--surface-muted)]">Référence : {error.digest}</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
