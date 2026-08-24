'use client';

import { useState, useTransition } from 'react';
import { TextAreaField, TextField } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { IconAlert, IconCheck } from '@/components/ui/icons';
import { submitInquiryAction } from '@/modules/content/inquiries';

type Labels = {
  name: string;
  email: string;
  phone: string;
  company: string;
  subject: string;
  message: string;
  send: string;
  sent: string;
  optional: string;
  generic: string;
  validation: string;
  rateLimited: string;
  fieldInvalid: string;
};

export function ContactForm({
  kind = 'CONTACT',
  labels,
}: {
  kind?: 'CONTACT' | 'PROFESSIONAL';
  labels: Labels;
}) {
  const [pending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const data = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await submitInquiryAction({
        kind,
        name: data.get('name'),
        email: data.get('email'),
        phone: data.get('phone') ?? '',
        company: data.get('company') ?? '',
        subject: data.get('subject') ?? '',
        message: data.get('message'),
        website: data.get('website') ?? '',
      });

      if (result.ok) {
        setSent(true);
        setErrors({});
        return;
      }

      setErrors(result.fieldErrors ?? {});
      setError(
        result.code === 'rate_limited'
          ? labels.rateLimited
          : result.code === 'validation_failed'
            ? labels.validation
            : labels.generic,
      );
    });
  };

  if (sent) {
    return (
      <p
        role="status"
        className="flex items-start gap-3 border border-[var(--color-positive)] px-4 py-4 text-sm"
      >
        <IconCheck width={16} height={16} className="mt-0.5 shrink-0 text-[var(--color-positive)]" />
        {labels.sent}
      </p>
    );
  }

  const errorFor = (field: string) => (errors[field]?.length ? labels.fieldInvalid : undefined);

  return (
    <form onSubmit={submit} noValidate className="grid gap-5 sm:grid-cols-2">
      {error ? (
        <p
          role="alert"
          className="flex items-start gap-3 rounded-md border border-[var(--color-critical)] px-4 py-3 text-sm sm:col-span-2"
        >
          <IconAlert width={16} height={16} className="mt-0.5 shrink-0 text-[var(--color-critical)]" />
          {error}
        </p>
      ) : null}

      <TextField id="name" label={labels.name} required autoComplete="name" error={errorFor('name')} />
      <TextField id="email" label={labels.email} type="email" required autoComplete="email" error={errorFor('email')} />
      <TextField id="phone" label={labels.phone} type="tel" optional optionalLabel={labels.optional} autoComplete="tel" />
      {kind === 'PROFESSIONAL' ? (
        <TextField id="company" label={labels.company} optional optionalLabel={labels.optional} />
      ) : (
        <TextField id="subject" label={labels.subject} optional optionalLabel={labels.optional} />
      )}
      <TextAreaField
        id="message"
        label={labels.message}
        required
        rows={6}
        className="sm:col-span-2"
        error={errorFor('message')}
      />

      {/* Honeypot: hidden from people, filled by naive bots. */}
      <div aria-hidden="true" className="visually-hidden">
        <label htmlFor="website">Ne pas remplir</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <Button type="submit" loading={pending} className="sm:col-span-2 sm:justify-self-start">
        {labels.send}
      </Button>
    </form>
  );
}
