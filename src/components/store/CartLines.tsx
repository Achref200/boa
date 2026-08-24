'use client';

import Link from 'next/link';
import { useOptimistic, useTransition } from 'react';
import { MediaFrame } from '@/components/ui/MediaFrame';
import { QuantityStepper } from './BuyPanel';
import { useCartContext } from './CartProvider';
import { useToast } from '@/components/ui/Toast';
import { setCartQuantityAction } from '@/modules/cart/actions';
import { formatMoney, multiplyMoney } from '@/lib/money';
import { IconTrash } from '@/components/ui/icons';
import type { PricedLine } from '@/modules/orders/pricing';

type Labels = {
  quantity: string;
  decrease: string;
  increase: string;
  remove: string;
  error: string;
  pending: string;
  format: string;
};

/**
 * Quantity changes are optimistic, but the *totals* are not recomputed in the
 * browser — the server returns the authoritative cart and the route revalidates.
 * Showing a client-computed total that then corrects itself is how customers
 * end up distrusting a checkout.
 */
export function CartLines({
  lines,
  locale,
  productBasePath,
  labels,
}: {
  lines: PricedLine[];
  locale: string;
  /** A path prefix, not a function: only serialisable props cross the RSC boundary. */
  productBasePath: string;
  labels: Labels;
}) {
  const [pending, startTransition] = useTransition();
  const { setItemCount } = useCartContext();
  const toast = useToast();
  const [optimistic, setOptimistic] = useOptimistic(
    lines,
    (current: PricedLine[], update: { variantId: string; quantity: number }) =>
      current
        .map((line) =>
          line.variantId === update.variantId
            ? {
                ...line,
                quantity: update.quantity,
                lineTotal: multiplyMoney(line.unitPrice, update.quantity),
              }
            : line,
        )
        .filter((line) => line.quantity > 0),
  );

  const change = (variantId: string, quantity: number) => {
    startTransition(async () => {
      setOptimistic({ variantId, quantity });
      const result = await setCartQuantityAction({ variantId, quantity });
      if (result.ok) setItemCount(result.data.itemCount);
      else toast(labels.error, 'error');
    });
  };

  return (
    <ul aria-busy={pending || undefined} className="border-t border-[var(--surface-line)]">
      {optimistic.map((line) => {
        const max = line.allowBackorder ? 20 : Math.min(20, line.stock);
        return (
          <li
            key={line.variantId}
            className="grid grid-cols-[5rem_minmax(0,1fr)] gap-4 border-b border-[var(--surface-line)] py-6 sm:grid-cols-[6rem_minmax(0,1fr)_auto] sm:gap-6"
          >
            <Link href={`${productBasePath}/${line.productSlug}`} className="block" tabIndex={-1} aria-hidden="true">
              <MediaFrame
                path={line.imagePath}
                alt=""
                sizes="96px"
                pendingLabel={labels.pending}
                className="w-full"
              />
            </Link>

            <div className="min-w-0">
              <Link href={`${productBasePath}/${line.productSlug}`} className="font-display text-lg hover:text-[var(--surface-accent)]">
                {line.productName}
              </Link>
              <p className="mt-1 text-xs uppercase tracking-[0.1em] text-[var(--surface-muted)]">
                {labels.format} · {line.format}
              </p>
              <p className="mt-1 text-sm tabular-nums text-[var(--surface-muted)]">
                {formatMoney(line.unitPrice, locale)}
              </p>

              <div className="mt-4 flex items-center gap-4 sm:hidden">
                <QuantityStepper
                  value={line.quantity}
                  max={Math.max(1, max)}
                  onChange={(quantity) => change(line.variantId, quantity)}
                  labels={labels}
                />
                <RemoveButton onClick={() => change(line.variantId, 0)} label={labels.remove} />
                <p className="ms-auto tabular-nums">{formatMoney(line.lineTotal, locale)}</p>
              </div>
            </div>

            <div className="hidden flex-col items-end justify-between sm:flex">
              <p className="tabular-nums">{formatMoney(line.lineTotal, locale)}</p>
              <div className="flex items-center gap-3">
                <QuantityStepper
                  value={line.quantity}
                  max={Math.max(1, max)}
                  onChange={(quantity) => change(line.variantId, quantity)}
                  labels={labels}
                />
                <RemoveButton onClick={() => change(line.variantId, 0)} label={labels.remove} />
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function RemoveButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="grid size-11 place-items-center text-[var(--surface-muted)] transition-colors hover:text-[var(--color-critical)]"
    >
      <IconTrash width={16} height={16} />
    </button>
  );
}
