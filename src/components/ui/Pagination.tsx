import Link from 'next/link';
import { cn } from '@/lib/cn';

/**
 * Real links, not buttons: a paginated catalogue must be crawlable and a
 * customer must be able to open page 3 in a new tab. The window is capped at
 * five numbers so a 400-page catalogue does not produce a 400-link control.
 */
export function Pagination({
  page,
  pageCount,
  hrefFor,
  labels,
}: {
  page: number;
  pageCount: number;
  hrefFor: (page: number) => string;
  labels: { previous: string; next: string; nav: string; page: string };
}) {
  if (pageCount <= 1) return null;

  const start = Math.max(1, Math.min(page - 2, pageCount - 4));
  const end = Math.min(pageCount, start + 4);
  const numbers = Array.from({ length: end - start + 1 }, (_, index) => start + index);

  const item =
    'inline-flex min-h-11 min-w-11 items-center justify-center border px-3 text-sm tabular-nums transition-colors';

  return (
    <nav aria-label={labels.nav} className="mt-16 flex items-center justify-center gap-2">
      {page > 1 ? (
        <Link
          href={hrefFor(page - 1)}
          rel="prev"
          className={cn(item, 'border-[var(--surface-line)] hover:border-[var(--surface-fg)]')}
        >
          {labels.previous}
        </Link>
      ) : null}

      <ul className="flex items-center gap-2">
        {numbers.map((number) => (
          <li key={number}>
            <Link
              href={hrefFor(number)}
              aria-current={number === page ? 'page' : undefined}
              aria-label={`${labels.page} ${number}`}
              className={cn(
                item,
                number === page
                  ? 'border-[var(--surface-fg)] bg-[var(--surface-fg)] text-[var(--surface-bg)]'
                  : 'border-[var(--surface-line)] hover:border-[var(--surface-fg)]',
              )}
            >
              {number}
            </Link>
          </li>
        ))}
      </ul>

      {page < pageCount ? (
        <Link
          href={hrefFor(page + 1)}
          rel="next"
          className={cn(item, 'border-[var(--surface-line)] hover:border-[var(--surface-fg)]')}
        >
          {labels.next}
        </Link>
      ) : null}
    </nav>
  );
}
