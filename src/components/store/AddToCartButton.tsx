'use client';

import { useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { useCartContext } from './CartProvider';
import { addManyToCartAction, addToCartAction } from '@/modules/cart/actions';

type Labels = { add: string; added: string; error: string; soldOut: string };

/**
 * Optimistic only where it is safe: the badge updates from the server's
 * authoritative count, not from a local increment, so a rejected add never
 * leaves a wrong number in the header.
 */
export function AddToCartButton({
  variantId,
  quantity = 1,
  disabled = false,
  labels,
  size = 'lg',
  className,
}: {
  variantId: string;
  quantity?: number;
  disabled?: boolean;
  labels: Labels;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const [pending, startTransition] = useTransition();
  const { setItemCount } = useCartContext();
  const toast = useToast();

  const submit = () => {
    startTransition(async () => {
      const result = await addToCartAction({ variantId, quantity });
      if (result.ok) {
        setItemCount(result.data.itemCount);
        toast(labels.added);
      } else {
        toast(labels.error, 'error');
      }
    });
  };

  return (
    <Button onClick={submit} loading={pending} disabled={disabled} size={size} className={className}>
      {disabled ? labels.soldOut : labels.add}
    </Button>
  );
}

export function AddRitualButton({
  variantIds,
  labels,
  className,
}: {
  variantIds: string[];
  labels: Labels;
  className?: string;
}) {
  const [pending, startTransition] = useTransition();
  const { setItemCount } = useCartContext();
  const toast = useToast();

  const submit = () => {
    startTransition(async () => {
      const result = await addManyToCartAction({ variantIds });
      if (result.ok) {
        setItemCount(result.data.itemCount);
        toast(labels.added);
      } else {
        toast(labels.error, 'error');
      }
    });
  };

  return (
    <Button onClick={submit} loading={pending} disabled={variantIds.length === 0} className={className}>
      {labels.add}
    </Button>
  );
}
