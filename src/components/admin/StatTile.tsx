import Link from 'next/link';
import { cn } from '@/lib/cn';

/**
 * A number worth acting on, with a link to the thing to act on.
 *
 * Deliberately no sparkline, no percentage-change badge and no icon: a
 * "+12% vs last week" on a shop taking a handful of orders a day is noise
 * dressed as insight. The tile earns its place only because the number is a
 * queue an administrator can empty.
 */
export function StatTile({
  label,
  value,
  hint,
  href,
  tone = 'neutral',
}: {
  label: string;
  value: string | number;
  hint?: string;
  href?: string;
  tone?: 'neutral' | 'attention';
}) {
  const body = (
    <>
      <p className="lockup text-[10px] text-[var(--surface-muted)]">{label}</p>
      {/* Sans, not the display serif: Bodoni's figure 1 is a bare stem, which is
          unreadable as a standalone metric. Display type is for prose. */}
      <p
        className={cn(
          'mt-3 text-[length:var(--text-xl)] font-medium tabular-nums leading-tight',
          tone === 'attention' && Number(value) > 0 && 'text-[var(--color-caution)]',
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-[var(--surface-muted)]">{hint}</p> : null}
    </>
  );

  const className =
    'block rounded-md border border-[var(--surface-line)] bg-[var(--surface-raised)] p-5 transition-colors';

  return href ? (
    <Link href={href} className={cn(className, 'hover:border-[var(--surface-fg)]')}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}
