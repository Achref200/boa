'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { IconAlert, IconTrash } from '@/components/ui/icons';
import { ConfirmButton } from './ConfirmButton';
import {
  deleteProductMediaAction,
  updateProductMediaAction,
  uploadProductMediaAction,
} from '@/modules/admin/actions/media';
import { mediaUrl } from '@/modules/media/url';

export type MediaItem = {
  id: string;
  path: string;
  alt: string | null;
  width: number | null;
  height: number | null;
  position: number;
};

/**
 * Upload, reorder, describe, delete.
 *
 * Order is changed with buttons rather than drag-and-drop: dragging is
 * unusable with a keyboard, awkward on a phone, and this list is rarely longer
 * than five items. Alt text sits beside each image because it is the only place
 * an administrator will ever think to write it, and the first image is labelled
 * as the one the catalogue grid will use — that is the decision being made here.
 */
export function ProductMediaManager({
  productId,
  media,
}: {
  productId: string;
  media: MediaItem[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [items, setItems] = useState(media);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError(null);
    setSaved(false);

    startTransition(async () => {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.set('productId', productId);
        formData.set('file', file);
        const result = await uploadProductMediaAction(formData);
        if (!result.ok) {
          setError(result.message);
          break;
        }
      }
      if (inputRef.current) inputRef.current.value = '';
      router.refresh();
    });
  };

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved!);
    setItems(next.map((item, position) => ({ ...item, position })));
    setSaved(false);
  };

  const save = () => {
    setError(null);
    startTransition(async () => {
      const result = await updateProductMediaAction({
        items: items.map((item, position) => ({ id: item.id, alt: item.alt, position })),
      });
      if (result.ok) {
        setSaved(true);
        router.refresh();
      } else {
        setError(result.message);
      }
    });
  };

  const remove = (id: string) => {
    startTransition(async () => {
      const result = await deleteProductMediaAction({ id });
      if (result.ok) {
        setItems((current) => current.filter((item) => item.id !== id));
        router.refresh();
      } else {
        setError(result.message);
      }
    });
  };

  return (
    <section className="rounded-md border border-[var(--surface-line)] bg-[var(--surface-raised)]">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--surface-line)] px-5 py-3">
        <div>
          <h2 className="lockup text-[var(--surface-muted)]">Visuels</h2>
          <p className="mt-2 text-xs text-[var(--surface-muted)]">
            Format attendu : portrait 4:5, 1600 × 2000 px minimum. Le premier visuel est celui
            affiché dans le catalogue.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            ref={inputRef}
            id="media-upload"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            multiple
            onChange={(event) => upload(event.target.files)}
            className="visually-hidden"
          />
          <Button
            type="button"
            intent="secondary"
            size="sm"
            loading={pending}
            onClick={() => inputRef.current?.click()}
          >
            Ajouter des visuels
          </Button>
        </div>
      </header>

      <div className="p-5">
        {error ? (
          <p role="alert" className="mb-4 flex items-start gap-3 rounded-md border border-[var(--color-critical)] px-4 py-3 text-sm">
            <IconAlert width={16} height={16} className="mt-0.5 shrink-0 text-[var(--color-critical)]" />
            {error}
          </p>
        ) : null}

        {saved ? (
          <p role="status" className="mb-4 border border-[var(--color-positive)] px-4 py-3 text-sm">
            Visuels enregistrés.
          </p>
        ) : null}

        {items.length === 0 ? (
          <p className="py-8 text-center text-sm text-[var(--surface-muted)]">
            Aucun visuel. La fiche produit affiche un emplacement « visuel à venir » en attendant.
          </p>
        ) : (
          <>
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((item, index) => (
                <li key={item.id} className="rounded-md border border-[var(--surface-line)] p-3">
                  <div className="relative aspect-[4/5] bg-[var(--surface-sunken)]">
                    <Image
                      src={mediaUrl(item.path) ?? ''}
                      alt={item.alt ?? ''}
                      fill
                      sizes="(max-width: 640px) 90vw, 30vw"
                      className="object-cover"
                    />
                    {index === 0 ? (
                      <span className="absolute top-2 bg-[var(--color-gold)] px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-[var(--color-ink)]"
                        style={{ insetInlineStart: '0.5rem' }}>
                        Principal
                      </span>
                    ) : null}
                  </div>

                  <label
                    htmlFor={`alt-${item.id}`}
                    className="lockup mt-3 block text-[10px] text-[var(--surface-muted)]"
                  >
                    Texte alternatif
                  </label>
                  <input
                    id={`alt-${item.id}`}
                    value={item.alt ?? ''}
                    onChange={(event) => {
                      const alt = event.target.value;
                      setItems((current) =>
                        current.map((entry) => (entry.id === item.id ? { ...entry, alt } : entry)),
                      );
                      setSaved(false);
                    }}
                    placeholder="Ce que montre l’image"
                    className="mt-1.5 min-h-10 w-full border border-[var(--surface-field-line)] bg-[var(--surface-bg)] px-2 text-sm"
                  />

                  <div className="mt-3 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => move(index, -1)}
                      disabled={index === 0}
                      aria-label="Déplacer avant"
                      className="min-h-10 rounded-md border border-[var(--surface-line)] px-3 text-xs disabled:opacity-40"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => move(index, 1)}
                      disabled={index === items.length - 1}
                      aria-label="Déplacer après"
                      className="min-h-10 rounded-md border border-[var(--surface-line)] px-3 text-xs disabled:opacity-40"
                    >
                      ↓
                    </button>
                    <span className="ms-auto text-[11px] text-[var(--surface-muted)] tabular-nums">
                      {item.width && item.height ? `${item.width}×${item.height}` : '—'}
                    </span>
                    <ConfirmButton
                      label="Supprimer ce visuel"
                      confirmTitle="Supprimer ce visuel ?"
                      confirmBody="Le fichier sera définitivement supprimé du serveur."
                      confirmLabel="Supprimer"
                      onConfirm={() => remove(item.id)}
                    >
                      <IconTrash width={14} height={14} />
                    </ConfirmButton>
                  </div>
                </li>
              ))}
            </ul>

            <Button type="button" intent="secondary" size="sm" loading={pending} onClick={save} className="mt-5">
              Enregistrer l’ordre et les descriptions
            </Button>
          </>
        )}
      </div>
    </section>
  );
}
