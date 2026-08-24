'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { mediaUrl } from '@/modules/media/url';
import { Petals } from '@/components/brand/Petals';
import { IconClose } from '@/components/ui/icons';
import { cn } from '@/lib/cn';
import type { MediaRef } from '@/modules/catalog/types';

type Labels = { gallery: string; pending: string; close: string; zoom: string };

/**
 * Desktop: a vertical thumbnail rail beside a 4:5 frame, click to zoom.
 * Mobile: the same images as a horizontal snap rail with dot pagination — no
 * thumbnails, because on a phone a swipe is faster than a second tap target.
 *
 * The zoom uses a native <dialog>, so Escape and focus trapping are the
 * browser's job. Arrow keys move between images when the rail has focus.
 */
export function ProductGallery({
  media,
  productName,
  labels,
}: {
  media: MediaRef[];
  productName: string;
  labels: Labels;
}) {
  const [active, setActive] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const railRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (zoomed && !dialog.open) dialog.showModal();
    if (!zoomed && dialog.open) dialog.close();
  }, [zoomed]);

  if (media.length === 0) {
    return (
      <div className="media-pending flex aspect-[4/5] flex-col items-center justify-center gap-3">
        <Petals size={32} />
        <span className="lockup">{labels.pending}</span>
        <span className="text-[11px] opacity-70">1600 × 2000</span>
      </div>
    );
  }

  const current = media[active] ?? media[0]!;

  const move = (delta: number) => {
    const next = (active + delta + media.length) % media.length;
    setActive(next);
    railRef.current?.children[next]?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  };

  return (
    <div className="flex flex-col gap-4 lg:flex-row-reverse lg:items-start lg:gap-6">
      {/* Main frame — desktop */}
      <div className="hidden flex-1 lg:block">
        <button
          type="button"
          onClick={() => setZoomed(true)}
          aria-label={labels.zoom}
          className="group relative block w-full cursor-zoom-in overflow-hidden bg-[var(--surface-sunken)]"
          style={{ aspectRatio: '4 / 5' }}
        >
          <Image
            src={mediaUrl(current.path) ?? ''}
            alt={current.alt ?? productName}
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 44vw"
            className="object-cover transition-transform duration-700 ease-[var(--ease-boa)] motion-safe:group-hover:scale-[1.03]"
          />
        </button>
      </div>

      {/* Thumbnail rail — desktop */}
      {media.length > 1 ? (
        <ul className="hidden w-20 shrink-0 flex-col gap-3 lg:flex" aria-label={labels.gallery}>
          {media.map((item, index) => (
            <li key={item.path}>
              <button
                type="button"
                onClick={() => setActive(index)}
                aria-current={index === active}
                aria-label={`${labels.gallery} ${index + 1}`}
                className={cn(
                  'relative block w-full overflow-hidden border transition-colors',
                  index === active
                    ? 'border-[var(--surface-fg)]'
                    : 'border-transparent hover:border-[var(--surface-line)]',
                )}
                style={{ aspectRatio: '4 / 5' }}
              >
                <Image
                  src={mediaUrl(item.path) ?? ''}
                  alt=""
                  fill
                  sizes="80px"
                  className="object-cover"
                />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {/* Swipe rail — mobile */}
      <div className="lg:hidden">
        <div
          ref={railRef}
          role="group"
          aria-label={labels.gallery}
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === 'ArrowRight') move(1);
            if (event.key === 'ArrowLeft') move(-1);
          }}
          onScroll={(event) => {
            const rail = event.currentTarget;
            const index = Math.round((rail.scrollLeft / rail.scrollWidth) * media.length);
            setActive(Math.min(media.length - 1, Math.max(0, index)));
          }}
          className="scroll-x no-scrollbar flex snap-x snap-mandatory"
        >
          {media.map((item, index) => (
            <div key={item.path} className="relative w-full shrink-0 snap-center" style={{ aspectRatio: '4 / 5' }}>
              <Image
                src={mediaUrl(item.path) ?? ''}
                alt={item.alt ?? `${productName} ${index + 1}`}
                fill
                priority={index === 0}
                sizes="100vw"
                className="object-cover"
              />
            </div>
          ))}
        </div>

        {media.length > 1 ? (
          <div className="mt-4 flex justify-center gap-2" aria-hidden="true">
            {media.map((item, index) => (
              <span
                key={item.path}
                className={cn(
                  'h-px w-8 transition-colors',
                  index === active ? 'bg-[var(--surface-fg)]' : 'bg-[var(--surface-line)]',
                )}
              />
            ))}
          </div>
        ) : null}
      </div>

      <dialog
        ref={dialogRef}
        onClose={() => setZoomed(false)}
        data-surface="paper"
        className="m-0 h-dvh max-h-dvh w-full max-w-none bg-[var(--surface-bg)] p-0 backdrop:bg-[rgb(30_31_33/0.9)]"
      >
        <div className="relative flex h-dvh items-center justify-center p-4">
          <button
            type="button"
            onClick={() => setZoomed(false)}
            aria-label={labels.close}
            className="absolute top-4 z-10 inline-flex min-h-11 min-w-11 items-center justify-center text-[var(--surface-fg)]"
            style={{ insetInlineEnd: '1rem' }}
          >
            <IconClose />
          </button>
          <div className="relative h-full w-full">
            <Image
              src={mediaUrl(current.path) ?? ''}
              alt={current.alt ?? productName}
              fill
              sizes="100vw"
              className="object-contain"
            />
          </div>
        </div>
      </dialog>
    </div>
  );
}
