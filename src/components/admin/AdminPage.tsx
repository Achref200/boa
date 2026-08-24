import { cn } from '@/lib/cn';

/**
 * One page frame for the whole operations application, so every screen has the
 * same heading level, the same measure and the same place for its primary
 * action. Consistency here is what makes an admin learnable in an afternoon.
 */
export function AdminPage({
  title,
  description,
  actions,
  children,
  wide = false,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={cn('mx-auto w-full px-4 py-8 sm:px-8 lg:py-12', wide ? 'max-w-[110rem]' : 'max-w-6xl')}>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[length:var(--text-xl)]">{title}</h1>
          {description ? (
            <p className="mt-2 max-w-2xl text-sm text-[var(--surface-muted)]">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
      </header>

      <div className="mt-8">{children}</div>
    </div>
  );
}

export function Panel({
  title,
  actions,
  children,
  className,
}: {
  title?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('rounded-md border border-[var(--surface-line)] bg-[var(--surface-raised)]', className)}>
      {title ? (
        <div className="flex items-center justify-between gap-4 border-b border-[var(--surface-line)] px-5 py-3">
          <h2 className="lockup text-[var(--surface-muted)]">{title}</h2>
          {actions}
        </div>
      ) : null}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function EmptyState({ message, hint }: { message: string; hint?: string }) {
  return (
    <div className="px-4 py-12 text-center">
      <p className="text-sm">{message}</p>
      {hint ? <p className="mt-2 text-xs text-[var(--surface-muted)]">{hint}</p> : null}
    </div>
  );
}
