import { cn } from '@/lib/cn';

/**
 * Status is carried by a word first and a colour second.
 *
 * The dot exists so the four tones remain distinguishable to someone who cannot
 * separate them by hue, and the label is always present — a colour-only status
 * pill is unreadable for roughly one man in twelve.
 */
export type StatusTone = 'positive' | 'caution' | 'critical' | 'informative' | 'neutral';

const TONES: Record<StatusTone, { dot: string; text: string }> = {
  positive: { dot: 'bg-[var(--color-positive)]', text: 'text-[var(--color-positive)]' },
  caution: { dot: 'bg-[var(--color-caution)]', text: 'text-[var(--color-caution)]' },
  critical: { dot: 'bg-[var(--color-critical)]', text: 'text-[var(--color-critical)]' },
  informative: { dot: 'bg-[var(--color-informative)]', text: 'text-[var(--color-informative)]' },
  neutral: { dot: 'bg-[var(--surface-muted)]', text: 'text-[var(--surface-fg)]' },
};

export function StatusBadge({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: StatusTone;
  children: React.ReactNode;
  className?: string;
}) {
  const style = TONES[tone];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-full border border-[var(--surface-line)] px-2.5 py-1 text-xs',
        style.text,
        className,
      )}
    >
      <span className={cn('size-1.5 shrink-0 rounded-full', style.dot)} aria-hidden="true" />
      {children}
    </span>
  );
}
