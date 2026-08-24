'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { IconClose, IconSearch } from '@/components/ui/icons';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import type { NeedView } from '@/modules/catalog/types';

type Labels = {
  filters: string;
  clear: string;
  apply: string;
  close: string;
  sort: string;
  sortRelevance: string;
  sortNewest: string;
  sortPriceAsc: string;
  sortPriceDesc: string;
  availability: string;
  inStockOnly: string;
  search: string;
  searchPlaceholder: string;
  needsTitle: string;
};

/**
 * Filters live in the URL, not in component state.
 *
 * That makes every filtered view shareable, bookmarkable, back-button-correct
 * and server-rendered — and it means the results are produced by one database
 * query rather than by shipping the catalogue to the browser. On desktop the
 * controls are a column; on mobile they collapse into a native <dialog> sheet
 * so the product grid is never squeezed.
 */
export function CatalogueFilters({
  needs,
  labels,
  resultCount,
}: {
  needs: NeedView[];
  labels: Labels;
  resultCount: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (sheetOpen && !dialog.open) dialog.showModal();
    if (!sheetOpen && dialog.open) dialog.close();
  }, [sheetOpen]);

  const selectedNeeds = new Set(searchParams.getAll('besoin'));
  const inStockOnly = searchParams.get('stock') === '1';
  const sort = searchParams.get('tri') ?? 'relevance';
  const activeCount = selectedNeeds.size + (inStockOnly ? 1 : 0);

  const commit = (next: URLSearchParams) => {
    next.delete('page'); // any filter change returns to the first page
    const query = next.toString();
    startTransition(() => router.push(query ? `${pathname}?${query}` : pathname, { scroll: true }));
  };

  const toggleNeed = (slug: string) => {
    const next = new URLSearchParams(searchParams.toString());
    const current = next.getAll('besoin');
    next.delete('besoin');
    const updated = current.includes(slug)
      ? current.filter((value) => value !== slug)
      : [...current, slug];
    updated.forEach((value) => next.append('besoin', value));
    commit(next);
  };

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(searchParams.toString());
    if (value === null) next.delete(key);
    else next.set(key, value);
    commit(next);
  };

  const clearAll = () => commit(new URLSearchParams());

  const controls = (
    <div className="flex flex-col gap-8">
      <SearchField labels={labels} initial={searchParams.get('q') ?? ''} onSubmit={(term) => setParam('q', term || null)} />

      {needs.length > 0 ? (
        <fieldset>
          <legend className="lockup mb-4 text-[var(--surface-muted)]">{labels.needsTitle}</legend>
          <ul className="flex flex-col gap-1">
            {needs.map((need) => {
              const checked = selectedNeeds.has(need.slug);
              return (
                <li key={need.id}>
                  <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleNeed(need.slug)}
                      className="size-4 shrink-0 appearance-none rounded-[4px] border border-[var(--surface-field-line)] bg-[var(--surface-field-bg)] checked:border-[var(--surface-fg)] checked:bg-[var(--surface-fg)]"
                    />
                    <span className={cn(checked && 'text-[var(--surface-accent)]')}>{need.name}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </fieldset>
      ) : null}

      <fieldset>
        <legend className="lockup mb-4 text-[var(--surface-muted)]">{labels.availability}</legend>
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={inStockOnly}
            onChange={() => setParam('stock', inStockOnly ? null : '1')}
            className="size-4 shrink-0 appearance-none rounded-[4px] border border-[var(--surface-field-line)] bg-[var(--surface-field-bg)] checked:border-[var(--surface-fg)] checked:bg-[var(--surface-fg)]"
          />
          <span>{labels.inStockOnly}</span>
        </label>
      </fieldset>

      <div>
        <label htmlFor="catalogue-sort" className="lockup mb-4 block text-[var(--surface-muted)]">
          {labels.sort}
        </label>
        <select
          id="catalogue-sort"
          value={sort}
          onChange={(event) => setParam('tri', event.target.value === 'relevance' ? null : event.target.value)}
          className="min-h-11 w-full border border-[var(--surface-field-line)] bg-[var(--surface-field-bg)] px-3 text-sm"
        >
          <option value="relevance">{labels.sortRelevance}</option>
          <option value="newest">{labels.sortNewest}</option>
          <option value="price_asc">{labels.sortPriceAsc}</option>
          <option value="price_desc">{labels.sortPriceDesc}</option>
        </select>
      </div>

      {activeCount > 0 ? (
        <button
          type="button"
          onClick={clearAll}
          className="self-start text-xs uppercase tracking-[0.12em] text-[var(--surface-muted)] underline underline-offset-4 hover:text-[var(--surface-fg)]"
        >
          {labels.clear}
        </button>
      ) : null}
    </div>
  );

  return (
    <>
      <div
        className={cn('hidden lg:block', pending && 'opacity-60 transition-opacity')}
        aria-busy={pending || undefined}
      >
        {controls}
      </div>

      <div className="flex items-center justify-between gap-4 lg:hidden">
        <Button intent="secondary" size="sm" onClick={() => setSheetOpen(true)}>
          {labels.filters}
          {activeCount > 0 ? ` (${activeCount})` : ''}
        </Button>
        <p className="text-xs text-[var(--surface-muted)]">{resultCount}</p>
      </div>

      <dialog
        ref={dialogRef}
        onClose={() => setSheetOpen(false)}
        data-surface="paper"
        className="m-0 mt-auto w-full max-w-none bg-transparent p-0 backdrop:bg-[rgb(30_31_33/0.5)]"
      >
        <div className="max-h-[85dvh] overflow-y-auto bg-[var(--surface-bg)] p-6 text-[var(--surface-fg)]">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="lockup">{labels.filters}</h2>
            <button
              type="button"
              onClick={() => setSheetOpen(false)}
              aria-label={labels.close}
              className="inline-flex min-h-11 min-w-11 items-center justify-center"
            >
              <IconClose />
            </button>
          </div>
          {controls}
          <Button className="mt-8 w-full" onClick={() => setSheetOpen(false)}>
            {labels.apply}
          </Button>
        </div>
      </dialog>
    </>
  );
}

function SearchField({
  labels,
  initial,
  onSubmit,
}: {
  labels: Labels;
  initial: string;
  onSubmit: (term: string) => void;
}) {
  const [value, setValue] = useState(initial);
  useEffect(() => setValue(initial), [initial]);

  return (
    <form
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(value.trim());
      }}
      className="relative"
    >
      <label htmlFor="catalogue-search" className="visually-hidden">
        {labels.search}
      </label>
      <input
        id="catalogue-search"
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={labels.searchPlaceholder}
        className="min-h-11 w-full border border-[var(--surface-field-line)] bg-[var(--surface-field-bg)] px-3 pe-11 text-sm placeholder:text-[var(--surface-muted)]"
      />
      <button
        type="submit"
        aria-label={labels.search}
        className="absolute inset-y-0 grid w-11 place-items-center text-[var(--surface-muted)] hover:text-[var(--surface-fg)]"
        style={{ insetInlineEnd: 0 }}
      >
        <IconSearch width={18} height={18} />
      </button>
    </form>
  );
}
