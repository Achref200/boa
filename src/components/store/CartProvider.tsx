'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { ToastProvider } from '@/components/ui/Toast';

/**
 * Holds only the badge count and the drawer's open state. The cart itself lives
 * in the database; this context exists so adding an item updates the header
 * immediately instead of waiting for a full route revalidation.
 */
type CartContextValue = {
  itemCount: number;
  setItemCount: (count: number) => void;
  isDrawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function useCartContext() {
  const value = useContext(CartContext);
  if (!value) throw new Error('useCartContext must be used inside <CartProvider>');
  return value;
}

export function CartProvider({
  children,
  initialCount,
}: {
  children: React.ReactNode;
  initialCount: number;
}) {
  const [itemCount, setItemCount] = useState(initialCount);
  const [isDrawerOpen, setDrawerOpen] = useState(false);

  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  const value = useMemo(
    () => ({ itemCount, setItemCount, isDrawerOpen, openDrawer, closeDrawer }),
    [itemCount, isDrawerOpen, openDrawer, closeDrawer],
  );

  return (
    <CartContext.Provider value={value}>
      <ToastProvider>{children}</ToastProvider>
    </CartContext.Provider>
  );
}
