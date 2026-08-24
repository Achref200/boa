import Link from 'next/link';
import { cn } from '@/lib/cn';

export type Column<T> = {
  key: string;
  header: string;
  /** Cell content. Kept as a render function so a column owns its formatting. */
  cell: (row: T) => React.ReactNode;
  align?: 'start' | 'end';
  /** Hidden below `lg`, where the stacked view shows only what matters. */
  secondary?: boolean;
  width?: string;
};

/**
 * A real <table> on desktop and a stacked list below `lg` — not a table with a
 * horizontal scrollbar, which is how admin screens become unusable on a phone.
 *
 * The stacked view is the same markup: each row becomes a definition list with
 * the column header as the term, so nothing is lost and the semantics stay
 * correct for screen readers in both layouts.
 */
export function DataTable<T extends { id: string }>({
  rows,
  columns,
  hrefFor,
  emptyMessage,
  caption,
}: {
  rows: T[];
  columns: Column<T>[];
  hrefFor?: (row: T) => string;
  emptyMessage: string;
  caption?: string;
}) {
  if (rows.length === 0) {
    return (
      <p className="rounded-md border border-[var(--surface-line)] bg-[var(--surface-raised)] px-4 py-12 text-center text-sm text-[var(--surface-muted)]">
        {emptyMessage}
      </p>
    );
  }

  return (
    <>
      <div className="hidden rounded-md border border-[var(--surface-line)] bg-[var(--surface-raised)] lg:block">
        <table className="w-full border-collapse text-sm">
          {caption ? <caption className="visually-hidden">{caption}</caption> : null}
          <thead>
            <tr className="border-b border-[var(--surface-line)]">
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  style={column.width ? { width: column.width } : undefined}
                  className={cn(
                    'lockup px-4 py-3 text-[10px] text-[var(--surface-muted)]',
                    column.align === 'end' ? 'text-end' : 'text-start',
                  )}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className="border-b border-[var(--surface-line)] last:border-0 hover:bg-[var(--surface-sunken)]"
              >
                {columns.map((column, index) => (
                  <td
                    key={column.key}
                    className={cn('px-4 py-3 align-middle', column.align === 'end' && 'text-end')}
                  >
                    {index === 0 && hrefFor ? (
                      <Link href={hrefFor(row)} className="hover:text-[var(--surface-accent)]">
                        {column.cell(row)}
                      </Link>
                    ) : (
                      column.cell(row)
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="flex flex-col gap-3 lg:hidden">
        {rows.map((row) => {
          const [lead, ...rest] = columns;
          return (
            <li
              key={row.id}
              className="rounded-md border border-[var(--surface-line)] bg-[var(--surface-raised)] p-4"
            >
              {lead ? (
                <p className="text-sm font-medium">
                  {hrefFor ? (
                    <Link href={hrefFor(row)} className="hover:text-[var(--surface-accent)]">
                      {lead.cell(row)}
                    </Link>
                  ) : (
                    lead.cell(row)
                  )}
                </p>
              ) : null}

              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
                {rest
                  .filter((column) => !column.secondary)
                  .map((column) => (
                    <div key={column.key}>
                      <dt className="lockup text-[10px] text-[var(--surface-muted)]">{column.header}</dt>
                      <dd className="mt-1 text-sm">{column.cell(row)}</dd>
                    </div>
                  ))}
              </dl>
            </li>
          );
        })}
      </ul>
    </>
  );
}
