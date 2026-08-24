'use client';

import Link from 'next/link';
import { useCartContext } from './CartProvider';
import { IconCart } from '@/components/ui/icons';

/**
 * The cart badge reads from context rather than the server render so adding an
 * item updates it instantly. The count is also announced politely, because a
 * silent number change is invisible to a screen-reader user.
 */
export function CartButton({ href, label, countLabel }: { href: string; label: string; countLabel: string }) {
  const { itemCount } = useCartContext();

  return (
    <Link
      href={href}
      className="relative inline-flex min-h-11 min-w-11 items-center justify-center text-[var(--surface-fg)] hover:text-[var(--surface-accent)]"
      aria-label={countLabel.replace('{count}', String(itemCount))}
    >
      <IconCart />
      {itemCount > 0 ? (
        <span
          className="absolute -top-0.5 grid size-4 place-items-center rounded-full bg-[var(--color-gold)] text-[10px] font-semibold text-[var(--color-ink)]"
          style={{ insetInlineEnd: '0.125rem' }}
        >
          {itemCount > 9 ? '9+' : itemCount}
        </span>
      ) : null}
      <span className="visually-hidden">{label}</span>
    </Link>
  );
}
