'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { IconSearch } from '@/components/ui/icons';

/**
 * Admin list filters, in the URL for the same reasons as the storefront ones:
 * a filtered view is shareable with a colleague and survives a refresh. Search
 * is debounced so typing does not fire a query per keystroke.
 */
export function AdminFilters({
  basePath,
  searchValue,
  searchLabel,
  searchPlaceholder,
  selects = [],
}: {
  basePath: string;
  searchValue: string;
  searchLabel: string;
  searchPlaceholder?: string;
  selects?: { name: string; label: string; value: string; options: { value: string; label: string }[] }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  const [term, setTerm] = useState(searchValue);

  useEffect(() => setTerm(searchValue), [searchValue]);

  const push = (next: URLSearchParams) => {
    next.delete('page');
    const qs = next.toString();
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : basePath));
  };

  useEffect(() => {
    if (term === searchValue) return;
    const timer = window.setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (term.trim()) next.set('q', term.trim());
      else next.delete('q');
      push(next);
    }, 350);
    return () => window.clearTimeout(timer);
    // `push` and `params` are stable enough for this debounce; re-running on
    // every render would cancel the timer before it ever fires.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term]);

  return (
    <div className="flex flex-wrap items-end gap-4">
      <div className="relative min-w-64 flex-1">
        <label htmlFor="admin-search" className="lockup mb-1.5 block text-[10px] text-[var(--surface-muted)]">
          {searchLabel}
        </label>
        <input
          id="admin-search"
          type="search"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder={searchPlaceholder}
          className="min-h-11 w-full border border-[var(--surface-field-line)] bg-[var(--surface-raised)] px-3 pe-10 text-sm"
        />
        <IconSearch
          width={16}
          height={16}
          className="pointer-events-none absolute bottom-3.5 text-[var(--surface-muted)]"
          style={{ insetInlineEnd: '0.75rem' }}
        />
      </div>

      {selects.map((select) => (
        <div key={select.name}>
          <label
            htmlFor={`admin-${select.name}`}
            className="lockup mb-1.5 block text-[10px] text-[var(--surface-muted)]"
          >
            {select.label}
          </label>
          <select
            id={`admin-${select.name}`}
            value={select.value}
            onChange={(event) => {
              const next = new URLSearchParams(params.toString());
              if (event.target.value) next.set(select.name, event.target.value);
              else next.delete(select.name);
              push(next);
            }}
            className="min-h-11 border border-[var(--surface-field-line)] bg-[var(--surface-raised)] px-3 text-sm"
          >
            {select.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );
}
