import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

/**
 * One field shell for input, select and textarea.
 *
 * The error is wired with `aria-describedby` and `aria-invalid` rather than
 * being coloured text next to the box, because colour alone is not an error
 * message. Labels are always visible — placeholder-as-label disappears exactly
 * when the customer is filling the form and needs it.
 */
const control =
  'min-h-11 w-full border bg-[var(--surface-field-bg)] px-3 text-sm ' +
  'border-[var(--surface-field-line)] placeholder:text-[var(--surface-muted)] ' +
  'aria-[invalid=true]:border-[var(--color-critical)] disabled:opacity-50';

function Shell({
  id,
  label,
  error,
  hint,
  optional,
  optionalLabel,
  children,
  className,
}: {
  id: string;
  label: string;
  error?: string | undefined;
  hint?: string | undefined;
  optional?: boolean;
  optionalLabel?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-xs uppercase tracking-[0.1em] text-[var(--surface-muted)]">
        {label}
        {optional ? <span className="ms-2 normal-case tracking-normal opacity-70">({optionalLabel})</span> : null}
      </label>
      {children}
      {hint && !error ? <p id={`${id}-hint`} className="text-xs text-[var(--surface-muted)]">{hint}</p> : null}
      {error ? (
        <p id={`${id}-error`} className="text-xs text-[var(--color-critical)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}

type BaseProps = {
  id: string;
  label: string;
  error?: string | undefined;
  hint?: string | undefined;
  optional?: boolean;
  optionalLabel?: string;
  className?: string;
};

export function TextField({
  id,
  label,
  error,
  hint,
  optional,
  optionalLabel,
  className,
  ...rest
}: BaseProps & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Shell {...{ id, label, error, hint, optional, optionalLabel, className }}>
      <input
        id={id}
        name={rest.name ?? id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={control}
        {...rest}
      />
    </Shell>
  );
}

export function SelectField({
  id,
  label,
  error,
  hint,
  optional,
  optionalLabel,
  className,
  children,
  ...rest
}: BaseProps & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <Shell {...{ id, label, error, hint, optional, optionalLabel, className }}>
      <select
        id={id}
        name={rest.name ?? id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={control}
        {...rest}
      >
        {children}
      </select>
    </Shell>
  );
}

export function TextAreaField({
  id,
  label,
  error,
  hint,
  optional,
  optionalLabel,
  className,
  ...rest
}: BaseProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <Shell {...{ id, label, error, hint, optional, optionalLabel, className }}>
      <textarea
        id={id}
        name={rest.name ?? id}
        rows={rest.rows ?? 3}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={cn(control, 'min-h-24 py-2 leading-relaxed')}
        {...rest}
      />
    </Shell>
  );
}

/** A radio presented as a full-width selectable row — comfortable on a phone. */
export function ChoiceRow({
  name,
  value,
  checked,
  onChange,
  title,
  description,
  disabled = false,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: (value: string) => void;
  title: string;
  description?: string | null;
  disabled?: boolean;
}) {
  return (
    <label
      className={cn(
        'flex min-h-14 cursor-pointer items-start gap-3 border p-4 transition-colors',
        checked ? 'border-[var(--surface-fg)]' : 'border-[var(--surface-line)] hover:border-[var(--surface-muted)]',
        disabled && 'cursor-not-allowed opacity-45',
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={() => onChange(value)}
        className="mt-1 size-4 shrink-0 appearance-none rounded-full border border-[var(--surface-field-line)] checked:border-[6px] checked:border-[var(--surface-fg)]"
      />
      <span className="flex flex-col gap-0.5">
        <span className="text-sm">{title}</span>
        {description ? (
          <span className="text-xs text-[var(--surface-muted)]">{description}</span>
        ) : null}
      </span>
    </label>
  );
}
