import Link from 'next/link';
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Three intents, and that is deliberate. `primary` resolves against the surface
 * context — gold carrying an ink label on both surfaces, which measures 7.0:1 —
 * so one component serves both halves of the art direction without a
 * `variant="onDark"` prop multiplying the API.
 *
 * Actions are pills. The mark's geometry is circular, and a rounded action is
 * the most legible target shape at a glance; see docs/BRAND.md §2. Labels are
 * sentence case rather than tracked capitals: "Ajouter au panier" is an
 * instruction from a shop, not an inscription.
 */
type Intent = 'primary' | 'secondary' | 'quiet';
type Size = 'sm' | 'md' | 'lg';

const base =
  'inline-flex items-center justify-center gap-2 rounded-full font-semibold ' +
  'transition-[background-color,border-color,color,box-shadow,transform] ' +
  'duration-[var(--duration-state)] ease-[var(--ease-boa)] ' +
  'disabled:cursor-not-allowed disabled:opacity-45 select-none ' +
  'whitespace-nowrap text-center';

const intents: Record<Intent, string> = {
  primary:
    'bg-[var(--action-bg)] text-[var(--action-fg)] hover:bg-[var(--action-bg-hover)] ' +
    'hover:shadow-[var(--shadow-1)] active:translate-y-px',
  secondary:
    'border border-[var(--surface-line)] text-[var(--surface-fg)] ' +
    'hover:border-[var(--surface-accent)] hover:bg-[var(--surface-sunken)]',
  quiet:
    'text-[var(--surface-accent)] underline decoration-transparent underline-offset-[6px] ' +
    'hover:decoration-[var(--surface-accent)]',
};

const sizes: Record<Size, string> = {
  // 44px minimum touch target on every size that appears on mobile; the two
  // larger sizes clear 48px, which is the Android figure the UX rules give.
  sm: 'min-h-10 px-4 text-sm',
  md: 'min-h-12 px-6 text-[0.9375rem]',
  lg: 'min-h-14 px-8 text-base',
};

export const buttonClass = (intent: Intent = 'primary', size: Size = 'md', className?: string) =>
  cn(base, intents[intent], sizes[size], className);

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  intent?: Intent;
  size?: Size;
  loading?: boolean;
  children: ReactNode;
};

export function Button({
  intent = 'primary',
  size = 'md',
  loading = false,
  disabled,
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClass(intent, size, className)}
    >
      {loading ? <Spinner /> : null}
      {children}
    </button>
  );
}

type ButtonLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  intent?: Intent;
  size?: Size;
  children: ReactNode;
};

export function ButtonLink({
  href,
  intent = 'primary',
  size = 'md',
  className,
  children,
  ...rest
}: ButtonLinkProps) {
  return (
    <Link href={href} {...rest} className={buttonClass(intent, size, className)}>
      {children}
    </Link>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-block size-3.5 shrink-0 rounded-full border-2 border-current border-t-transparent',
        'motion-safe:animate-spin',
        className,
      )}
      aria-hidden="true"
    />
  );
}
