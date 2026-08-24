'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { IconClose, IconMenu } from '@/components/ui/icons';

export type NavLink = { href: string; label: string; children?: NavLink[] };

/**
 * Built on the native <dialog>, which gives focus trapping, Escape-to-close and
 * inert background for free — all things a hand-rolled drawer gets subtly wrong.
 * The panel slides from the inline start, so it opens from the left in French
 * and English and from the right in Arabic without a second implementation.
 */
export function MobileNav({ links, label, closeLabel }: { links: NavLink[]; label: string; closeLabel: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // Route changes must close the drawer; otherwise the panel survives navigation.
  useEffect(() => setOpen(false), [pathname]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={label}
        aria-expanded={open}
        className="inline-flex min-h-11 min-w-11 items-center justify-center text-[var(--surface-fg)] lg:hidden"
      >
        <IconMenu />
      </button>

      <dialog
        ref={dialogRef}
        onClose={() => setOpen(false)}
        onClick={(event) => {
          if (event.target === dialogRef.current) setOpen(false);
        }}
        data-surface="paper"
        className="m-0 h-dvh max-h-dvh w-full max-w-none bg-transparent p-0 backdrop:bg-[rgb(30_31_33/0.6)]"
      >
        <div
          className="flex h-dvh w-[min(22rem,88vw)] flex-col bg-[var(--surface-bg)] text-[var(--surface-fg)] motion-safe:animate-[boa-slide_var(--duration-state)_var(--ease-boa)]"
          style={{ marginInlineEnd: 'auto' }}
        >
          <div className="flex items-center justify-between border-b border-[var(--surface-line)] px-5 py-4">
            <span className="lockup text-[var(--surface-muted)]">{label}</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={closeLabel}
              className="inline-flex min-h-11 min-w-11 items-center justify-center"
            >
              <IconClose />
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto px-5 py-6" aria-label={label}>
            <ul className="flex flex-col gap-1">
              {links.map((link) => (
                <li key={link.href} className="border-b border-[var(--surface-line)] last:border-0">
                  <Link
                    href={link.href}
                    className="font-display block py-3 text-2xl hover:text-[var(--surface-accent)]"
                  >
                    {link.label}
                  </Link>
                  {link.children && link.children.length > 0 ? (
                    <ul className="pb-3 ps-1">
                      {link.children.map((child) => (
                        <li key={child.href}>
                          <Link
                            href={child.href}
                            className="block py-2 text-sm text-[var(--surface-muted)] hover:text-[var(--surface-fg)]"
                          >
                            {child.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </dialog>
    </>
  );
}
