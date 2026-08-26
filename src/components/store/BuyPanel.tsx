'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { IconMinus, IconPlus } from '@/components/ui/icons';
import { useToast } from '@/components/ui/Toast';
import { useCartContext } from './CartProvider';
import { addToCartAction } from '@/modules/cart/actions';
import { formatMoney, type MoneyString } from '@/lib/money';
import { cn } from '@/lib/cn';
import type { ProductVariantView } from '@/modules/catalog/types';

type Labels = {
  chooseFormat: string;
  quantity: string;
  add: string;
  added: string;
  soldOut: string;
  lowStock: string;
  error: string;
  decrease: string;
  increase: string;
};

const MAX_PER_LINE = 20;

/**
 * The buy panel is the only stateful thing on the product page.
 *
 * Format selection is a radio group, not a `<select>`: with two or three
 * formats the prices need to be visible side by side to be compared, and a
 * dropdown hides exactly the information that decides the purchase. The sticky
 * mobile bar mirrors this panel and appears only after it scrolls out of view —
 * a bar that is there on arrival is the template tell.
 */
export function BuyPanel({
  variants,
  locale,
  labels,
  productName,
}: {
  variants: ProductVariantView[];
  locale: string;
  labels: Labels;
  productName: string;
}) {
  const firstAvailable = variants.find((variant) => variant.stock > 0 || variant.allowBackorder);
  const [variantId, setVariantId] = useState(firstAvailable?.id ?? variants[0]?.id ?? '');
  const [quantity, setQuantity] = useState(1);
  const [pending, startTransition] = useTransition();
  const [showSticky, setShowSticky] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const { setItemCount } = useCartContext();
  const toast = useToast();

  const selected = variants.find((variant) => variant.id === variantId) ?? variants[0];
  const soldOut = !selected || (selected.stock <= 0 && !selected.allowBackorder);
  const maxQuantity = selected?.allowBackorder ? MAX_PER_LINE : Math.min(MAX_PER_LINE, selected?.stock ?? 0);

  useEffect(() => {
    setQuantity((current) => Math.min(Math.max(1, current), Math.max(1, maxQuantity)));
  }, [maxQuantity]);

  useEffect(() => {
    const node = panelRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      ([entry]) => setShowSticky(!entry?.isIntersecting),
      { rootMargin: '0px 0px -40% 0px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const submit = () => {
    if (!selected) return;
    startTransition(async () => {
      const result = await addToCartAction({ variantId: selected.id, quantity });
      if (result.ok) {
        setItemCount(result.data.itemCount);
        toast(labels.added);
      } else {
        toast(labels.error, 'error');
      }
    });
  };

  const lowStock =
    selected && !selected.allowBackorder && selected.stock > 0 && selected.stock <= selected.lowStockAt;

  return (
    <>
      <div ref={panelRef} className="flex flex-col gap-8">
        {variants.length > 1 ? (
          <fieldset>
            <legend className="lockup mb-4 text-[var(--surface-muted)]">{labels.chooseFormat}</legend>
            <div className="flex flex-wrap gap-2">
              {variants.map((variant) => {
                const unavailable = variant.stock <= 0 && !variant.allowBackorder;
                const checked = variant.id === variantId;
                return (
                  <label
                    key={variant.id}
                    className={cn(
                      /* `relative` anchors the visually-hidden radio to its own
                         label — see BookingCalendar for what happens without it. */
                      'relative flex min-h-14 cursor-pointer flex-col justify-center border px-4 py-2 transition-colors',
                      checked
                        ? 'border-[var(--surface-fg)] bg-[var(--surface-fg)] text-[var(--surface-bg)]'
                        : 'border-[var(--surface-line)] hover:border-[var(--surface-fg)]',
                      unavailable && 'cursor-not-allowed opacity-45',
                    )}
                  >
                    <input
                      type="radio"
                      name="variant"
                      value={variant.id}
                      checked={checked}
                      disabled={unavailable}
                      onChange={() => setVariantId(variant.id)}
                      className="visually-hidden"
                    />
                    <span className="text-sm">{variant.format}</span>
                    <span className="text-xs tabular-nums">
                      {formatMoney(variant.price, locale)}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        ) : null}

        <div className="flex flex-wrap items-end gap-4">
          <QuantityStepper
            value={quantity}
            max={Math.max(1, maxQuantity)}
            disabled={soldOut}
            onChange={setQuantity}
            labels={labels}
          />
          <Button
            onClick={submit}
            loading={pending}
            disabled={soldOut}
            size="lg"
            className="flex-1"
          >
            {soldOut ? labels.soldOut : labels.add}
          </Button>
        </div>

        {lowStock && selected ? (
          <p role="status" className="text-xs uppercase tracking-[0.1em] text-[var(--color-caution)]">
            {labels.lowStock.replace('{count}', String(selected.stock))}
          </p>
        ) : null}
      </div>

      {/* Mobile sticky bar: only after the panel above has scrolled away. */}
      <div
        data-surface="paper"
        aria-hidden={!showSticky}
        className={cn(
          'fixed inset-x-0 bottom-0 z-[var(--z-sticky)] border-t border-[var(--surface-line)] bg-[var(--surface-raised)] p-3 transition-transform duration-[var(--duration-state)] ease-[var(--ease-boa)] lg:hidden',
          showSticky ? 'translate-y-0' : 'translate-y-full',
        )}
        style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
      >
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-[var(--surface-muted)]">{productName}</p>
            {selected ? (
              <p className="text-sm tabular-nums">
                {selected.format} · {formatMoney(selected.price, locale)}
              </p>
            ) : null}
          </div>
          <Button onClick={submit} loading={pending} disabled={soldOut || !showSticky} size="md">
            {soldOut ? labels.soldOut : labels.add}
          </Button>
        </div>
      </div>
    </>
  );
}

export function QuantityStepper({
  value,
  max,
  disabled = false,
  onChange,
  labels,
}: {
  value: number;
  max: number;
  disabled?: boolean;
  onChange: (value: number) => void;
  labels: { quantity: string; decrease: string; increase: string };
}) {
  const step = (delta: number) => onChange(Math.min(max, Math.max(1, value + delta)));
  const button =
    'grid size-11 place-items-center rounded-full border border-[var(--surface-line)] transition-colors hover:border-[var(--surface-fg)] disabled:opacity-40 disabled:hover:border-[var(--surface-line)]';

  return (
    <div className="flex items-center gap-2">
      <span className="visually-hidden" id="quantity-label">
        {labels.quantity}
      </span>
      <button
        type="button"
        onClick={() => step(-1)}
        disabled={disabled || value <= 1}
        aria-label={labels.decrease}
        className={button}
      >
        <IconMinus width={16} height={16} />
      </button>
      <output
        aria-labelledby="quantity-label"
        aria-live="polite"
        className="w-8 text-center text-sm tabular-nums"
      >
        {value}
      </output>
      <button
        type="button"
        onClick={() => step(1)}
        disabled={disabled || value >= max}
        aria-label={labels.increase}
        className={button}
      >
        <IconPlus width={16} height={16} />
      </button>
    </div>
  );
}

export type { MoneyString };
