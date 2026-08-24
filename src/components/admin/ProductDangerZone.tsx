'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { ConfirmButton } from './ConfirmButton';
import { Button } from '@/components/ui/Button';
import { deleteProductAction, setProductStateAction } from '@/modules/admin/actions/products';

/**
 * Publish, unpublish, archive — separated from the main form because they take
 * effect immediately rather than on save, and because archiving deserves a
 * confirmation the rest of the form does not.
 */
export function ProductDangerZone({ productId, state }: { productId: string; state: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const change = (next: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED') => {
    setError(null);
    startTransition(async () => {
      const result = await setProductStateAction({ id: productId, state: next });
      if (result.ok) router.refresh();
      else setError(result.code === 'forbidden' ? 'Droits insuffisants.' : 'Action impossible.');
    });
  };

  return (
    <section className="rounded-md border border-[var(--surface-line)] bg-[var(--surface-raised)]">
      <header className="border-b border-[var(--surface-line)] px-5 py-3">
        <h2 className="lockup text-[var(--surface-muted)]">Publication</h2>
      </header>

      <div className="flex flex-wrap items-center gap-3 p-5">
        {state !== 'PUBLISHED' ? (
          <Button type="button" size="sm" loading={pending} onClick={() => change('PUBLISHED')}>
            Publier
          </Button>
        ) : (
          <Button type="button" intent="secondary" size="sm" loading={pending} onClick={() => change('DRAFT')}>
            Dépublier
          </Button>
        )}

        <ConfirmButton
          label="Archiver le produit"
          confirmTitle="Archiver ce produit ?"
          confirmBody="Le produit disparaît du site mais reste lié à ses commandes passées. Rien n’est supprimé de la base : l’action est réversible en repassant l’état à « brouillon »."
          confirmLabel="Archiver"
          onConfirm={async () => {
            const result = await deleteProductAction({ id: productId });
            if (result.ok) router.refresh();
            else setError('Archivage impossible.');
          }}
        />

        {error ? (
          <p role="alert" className="text-sm text-[var(--color-critical)]">
            {error}
          </p>
        ) : null}
      </div>
    </section>
  );
}
