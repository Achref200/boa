import Image from 'next/image';
import { mediaUrl } from '@/modules/media/url';
import { Petals } from '@/components/brand/Petals';
import { cn } from '@/lib/cn';

type MediaFrameProps = {
  path: string | null | undefined;
  alt: string;
  /** Aspect ratio, or 'auto' to fill the parent (the parent must set a height). */
  ratio?: string | 'auto';
  sizes?: string;
  priority?: boolean;
  className?: string;
  pendingLabel: string;
  /** Shown inside the placeholder so it is obvious what asset is expected. */
  expected?: string;
};

/**
 * One image frame for the whole storefront.
 *
 * When BOA has not supplied an asset it renders a stated placeholder — the
 * petal seal plus the expected dimensions — instead of a stock photograph or a
 * grey box. That keeps a missing asset visible to whoever has to fill it, and
 * keeps the layout stable because the ratio is reserved either way.
 */
const POSITION = /(?:^|\s)(?:static|fixed|absolute|relative|sticky)(?:\s|$)/;

export function MediaFrame({
  path,
  alt,
  ratio = '4 / 5',
  sizes = '(max-width: 640px) 92vw, 30vw',
  priority = false,
  className,
  pendingLabel,
  expected,
}: MediaFrameProps) {
  const url = mediaUrl(path);
  /* `cn` joins class names, it does not resolve Tailwind conflicts. A caller that
     needs its own position — `absolute inset-0` inside a stretched grid cell —
     therefore emitted `relative absolute`, and Tailwind orders `relative` last,
     so the frame kept `position: relative`, `inset-0` did nothing, the box
     collapsed to 0px and the image vanished without an error. The frame supplies
     `relative` only when the caller has not chosen a position of its own. */
  const positioned = POSITION.test(className ?? '');

  return (
    <div
      className={cn(
        !positioned && 'relative',
        'overflow-hidden bg-[var(--surface-sunken)]',
        className,
      )}
      style={ratio === 'auto' ? undefined : { aspectRatio: ratio }}
    >
      {url ? (
        <Image
          src={url}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          className="object-cover"
        />
      ) : (
        <div className="media-pending absolute inset-0 flex-col gap-3 p-4 text-center">
          <Petals size={28} />
          <span className="lockup">{pendingLabel}</span>
          {expected ? <span className="text-[11px] opacity-70">{expected}</span> : null}
        </div>
      )}
    </div>
  );
}
