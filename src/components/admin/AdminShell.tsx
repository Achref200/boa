'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { IconClose, IconMenu } from '@/components/ui/icons';
import { Petals } from '@/components/brand/Petals';
import { cn } from '@/lib/cn';

export type NavGroup = {
  title: string;
  items: { href: string; label: string; badge?: number }[];
};

/**
 * Ink rail, paper workspace.
 *
 * The navigation is grouped by the job an administrator is doing — selling,
 * booking, publishing, configuring — rather than by database table, so someone
 * who has been asked to "check today's orders" does not have to know which
 * entity that lives in. Below `lg` the rail becomes a native <dialog> drawer;
 * the workspace never shrinks to accommodate it.
 */
export function AdminShell({
  groups,
  adminName,
  roleLabel,
  signOut,
  children,
}: {
  groups: NavGroup[];
  adminName: string;
  roleLabel: string;
  signOut: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => setOpen(false), [pathname]);

  const isActive = (href: string) =>
    href === '/admin' ? pathname === '/admin' : pathname.startsWith(href);

  const rail = (
    <nav aria-label="Administration" className="flex h-full flex-col gap-8 overflow-y-auto p-6">
      <Link href="/admin" className="flex items-center gap-3">
        <Petals size={22} className="text-[var(--surface-accent)]" />
        <span className="lockup">BOA Admin</span>
      </Link>

      <div className="flex flex-1 flex-col gap-7">
        {groups.map((group) => (
          <div key={group.title}>
            <h2 className="lockup mb-3 text-[10px] text-[var(--surface-muted)]">{group.title}</h2>
            <ul className="flex flex-col">
              {group.items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={isActive(item.href) ? 'page' : undefined}
                    className={cn(
                      'flex min-h-10 items-center justify-between gap-3 border-s-2 ps-3 pe-2 text-sm transition-colors',
                      isActive(item.href)
                        ? 'border-[var(--surface-accent)] text-[var(--surface-fg)]'
                        : 'border-transparent text-[var(--surface-muted)] hover:border-[var(--surface-line)] hover:text-[var(--surface-fg)]',
                    )}
                  >
                    {item.label}
                    {item.badge && item.badge > 0 ? (
                      <span className="min-w-5 shrink-0 bg-[var(--color-gold)] px-1.5 text-center text-[11px] font-medium tabular-nums text-[var(--color-ink)]">
                        {item.badge > 99 ? '99+' : item.badge}
                      </span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-[var(--surface-line)] pt-5">
        <p className="text-sm">{adminName}</p>
        <p className="text-xs text-[var(--surface-muted)]">{roleLabel}</p>
        <div className="mt-4">{signOut}</div>
      </div>
    </nav>
  );

  return (
    <div className="flex min-h-dvh">
      <aside
        data-surface="ink"
        className="hidden w-64 shrink-0 bg-[var(--surface-bg)] text-[var(--surface-fg)] lg:block"
      >
        <div className="sticky top-0 h-dvh">{rail}</div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header
          data-surface="ink"
          className="flex items-center gap-3 bg-[var(--surface-bg)] px-4 py-3 text-[var(--surface-fg)] lg:hidden"
        >
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Menu"
            aria-expanded={open}
            className="inline-flex min-h-11 min-w-11 items-center justify-center"
          >
            <IconMenu />
          </button>
          <span className="lockup">BOA Admin</span>
        </header>

        <main data-surface="paper" className="flex-1 bg-[var(--surface-sunken)] text-[var(--surface-fg)]">
          {children}
        </main>
      </div>

      <dialog
        ref={dialogRef}
        onClose={() => setOpen(false)}
        data-surface="ink"
        className="m-0 h-dvh max-h-dvh w-full max-w-none bg-transparent p-0 backdrop:bg-[rgb(30_31_33/0.6)]"
      >
        <div className="relative flex h-dvh w-[min(20rem,86vw)] flex-col bg-[var(--surface-bg)] text-[var(--surface-fg)]">
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Fermer"
            className="absolute top-4 inline-flex min-h-11 min-w-11 items-center justify-center"
            style={{ insetInlineEnd: '0.5rem' }}
          >
            <IconClose />
          </button>
          {rail}
        </div>
      </dialog>
    </div>
  );
}
