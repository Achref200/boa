import Link from 'next/link';
import { Petals } from '@/components/brand/Petals';

/**
 * The locale is not available to a not-found boundary (it renders outside the
 * matched route), so this page speaks French with an English line under it
 * rather than guessing wrong and speaking neither.
 */
export default function StorefrontNotFound() {
  return (
    <section data-surface="paper" className="bg-[var(--surface-bg)] text-[var(--surface-fg)]">
      <div className="container-page grid min-h-[60dvh] place-items-center py-20 text-center">
        <div className="flex max-w-md flex-col items-center gap-6">
          <Petals size={40} className="text-[var(--surface-accent)]" />
          <h1 className="font-display text-[length:var(--text-2xl)]">Page introuvable</h1>
          <p className="text-sm leading-relaxed text-[var(--surface-muted)]">
            Cette page n’existe pas ou a été déplacée.
            <span className="mt-1 block">This page does not exist or has moved.</span>
          </p>
          <Link
            href="/fr/soins"
            className="mt-2 inline-flex min-h-11 items-center rounded-full border border-[var(--surface-line)] px-6 text-sm font-semibold hover:border-[var(--surface-fg)]"
          >
            Voir les soins
          </Link>
        </div>
      </div>
    </section>
  );
}
