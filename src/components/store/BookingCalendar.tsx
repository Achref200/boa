'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { TextAreaField, TextField } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { IconAlert } from '@/components/ui/icons';
import { createReservationAction } from '@/modules/reservations/actions';
import { cn } from '@/lib/cn';
import type { AppLocale } from '@/i18n/config';

/**
 * Times are formatted on the server, in Africa/Tunis, and shipped as strings.
 *
 * If the client formatted them, a customer in Paris would be offered "10:00"
 * for a slot BOA holds at 09:00 — and would arrive an hour early. The only date
 * arithmetic that happens in the browser is choosing which day's list to show.
 */
export type BookableDay = {
  date: string;
  dayLabel: string;
  weekdayLabel: string;
  slots: { id: string; time: string; remaining: number }[];
};

type Labels = {
  chooseDate: string;
  chooseSlot: string;
  noSlots: string;
  slotsLeft: string;
  full: string;
  yourDetails: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  phoneHint: string;
  note: string;
  optional: string;
  confirm: string;
  confirming: string;
  slotTaken: string;
  generic: string;
  validation: string;
  rateLimited: string;
  fieldInvalid: string;
};

export function BookingCalendar({
  locale,
  serviceId,
  days,
  labels,
  defaults,
  confirmationBasePath,
}: {
  locale: AppLocale;
  serviceId: string;
  days: BookableDay[];
  labels: Labels;
  defaults: { firstName: string; lastName: string; email: string; phone: string };
  confirmationBasePath: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [activeDate, setActiveDate] = useState(days[0]?.date ?? '');
  const [slotId, setSlotId] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  const [idempotencyKey] = useState(() =>
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );

  const day = useMemo(() => days.find((entry) => entry.date === activeDate), [days, activeDate]);

  if (days.length === 0) {
    return (
      <p role="status" className="rounded-md border border-[var(--surface-line)] px-6 py-16 text-center text-sm text-[var(--surface-muted)]">
        {labels.noSlots}
      </p>
    );
  }

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await createReservationAction({
        locale,
        idempotencyKey,
        serviceId,
        slotId,
        firstName: formData.get('firstName'),
        lastName: formData.get('lastName'),
        email: formData.get('email'),
        phone: formData.get('phone'),
        note: formData.get('note') ?? '',
      });

      if (result.ok) {
        router.push(`${confirmationBasePath}/${result.data.reference}`);
        return;
      }

      setErrors(result.fieldErrors ?? {});
      setFormError(
        result.code === 'slot_unavailable'
          ? labels.slotTaken
          : result.code === 'validation_failed'
            ? labels.validation
            : result.code === 'rate_limited'
              ? labels.rateLimited
              : labels.generic,
      );
      // A taken slot has to disappear from the choice, not just show a message.
      if (result.code === 'slot_unavailable') {
        setSlotId('');
        router.refresh();
      }
      document.getElementById('booking-error')?.focus();
    });
  };

  const errorFor = (field: string) => (errors[field]?.length ? labels.fieldInvalid : undefined);

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-12">
      {formError ? (
        <div
          id="booking-error"
          role="alert"
          tabIndex={-1}
          className="flex items-start gap-3 rounded-md border border-[var(--color-critical)] px-4 py-3 text-sm"
        >
          <IconAlert width={16} height={16} className="mt-0.5 shrink-0 text-[var(--color-critical)]" />
          <span>{formError}</span>
        </div>
      ) : null}

      <fieldset>
        <legend className="lockup mb-5 text-[var(--surface-accent)]">{labels.chooseDate}</legend>
        <div className="scroll-x no-scrollbar -mx-1 flex snap-x gap-2 px-1 pb-2" role="tablist" aria-label={labels.chooseDate}>
          {days.map((entry) => {
            const free = entry.slots.some((slot) => slot.remaining > 0);
            const selected = entry.date === activeDate;
            return (
              <button
                key={entry.date}
                type="button"
                role="tab"
                aria-selected={selected}
                disabled={!free}
                onClick={() => {
                  setActiveDate(entry.date);
                  setSlotId('');
                }}
                className={cn(
                  'flex min-h-16 w-20 shrink-0 snap-start flex-col items-center justify-center gap-0.5 rounded-sm border px-2 transition-colors',
                  selected
                    ? 'border-[var(--surface-fg)] bg-[var(--surface-fg)] text-[var(--surface-bg)]'
                    : 'border-[var(--surface-line)] hover:border-[var(--surface-fg)]',
                  !free && 'cursor-not-allowed opacity-35 hover:border-[var(--surface-line)]',
                )}
              >
                <span className="text-[10px] uppercase tracking-[0.12em] opacity-70">
                  {entry.weekdayLabel}
                </span>
                <span className="text-sm tabular-nums">{entry.dayLabel}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className="lockup mb-5 text-[var(--surface-accent)]">{labels.chooseSlot}</legend>
        {day && day.slots.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {day.slots.map((slot) => {
              const full = slot.remaining <= 0;
              const selected = slot.id === slotId;
              return (
                <label
                  key={slot.id}
                  className={cn(
                    'flex min-h-14 cursor-pointer flex-col justify-center rounded-sm border px-4 py-2 transition-colors',
                    selected
                      ? 'border-[var(--surface-fg)] bg-[var(--surface-fg)] text-[var(--surface-bg)]'
                      : 'border-[var(--surface-line)] hover:border-[var(--surface-fg)]',
                    full && 'cursor-not-allowed opacity-40',
                  )}
                >
                  <input
                    type="radio"
                    name="slotId"
                    value={slot.id}
                    checked={selected}
                    disabled={full}
                    onChange={() => setSlotId(slot.id)}
                    className="visually-hidden"
                  />
                  <span className="text-sm tabular-nums">{slot.time}</span>
                  <span className="text-[11px] opacity-70">
                    {full ? labels.full : labels.slotsLeft.replace('{count}', String(slot.remaining))}
                  </span>
                </label>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-[var(--surface-muted)]">{labels.noSlots}</p>
        )}
      </fieldset>

      <fieldset>
        <legend className="lockup mb-5 text-[var(--surface-accent)]">{labels.yourDetails}</legend>
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField id="firstName" label={labels.firstName} defaultValue={defaults.firstName} autoComplete="given-name" required error={errorFor('firstName')} />
          <TextField id="lastName" label={labels.lastName} defaultValue={defaults.lastName} autoComplete="family-name" required error={errorFor('lastName')} />
          <TextField id="email" label={labels.email} type="email" defaultValue={defaults.email} autoComplete="email" required error={errorFor('email')} />
          <TextField id="phone" label={labels.phone} type="tel" defaultValue={defaults.phone} autoComplete="tel" required hint={labels.phoneHint} error={errorFor('phone')} />
          <TextAreaField id="note" label={labels.note} optional optionalLabel={labels.optional} className="sm:col-span-2" />
        </div>
      </fieldset>

      <Button type="submit" size="lg" loading={pending} disabled={!slotId} className="self-start">
        {pending ? labels.confirming : labels.confirm}
      </Button>
    </form>
  );
}
