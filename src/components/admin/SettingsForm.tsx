'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { TextAreaField, TextField } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { IconAlert } from '@/components/ui/icons';
import { saveSettingsAction } from '@/modules/admin/actions/content';

export type SettingField = { key: string; label: string; hint?: string; multiline?: boolean };

/**
 * The company facts the storefront needs and BOA has not yet supplied.
 *
 * Every field left empty stays empty on the site — the footer prints
 * "coordonnées à compléter" rather than a plausible-looking placeholder
 * address, which is the difference between an unfinished site and a
 * misleading one.
 */
export function SettingsForm({
  fields,
  values: initial,
}: {
  fields: SettingField[];
  values: Record<string, string>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSaved(false);

    startTransition(async () => {
      const payload: Record<string, string> = {};
      for (const field of fields) payload[field.key] = values[field.key] ?? '';

      const result = await saveSettingsAction(payload);
      if (result.ok) {
        setErrors({});
        setSaved(true);
        router.refresh();
      } else {
        setErrors(result.fieldErrors ?? {});
        setError(
          result.code === 'validation_failed'
            ? 'Vérifiez les champs signalés.'
            : 'Enregistrement impossible.',
        );
      }
    });
  };

  const update = (key: string) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const next = event.target.value;
    setValues((current) => ({ ...current, [key]: next }));
    setSaved(false);
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6">
      {error ? (
        <p role="alert" className="flex items-start gap-3 rounded-md border border-[var(--color-critical)] px-4 py-3 text-sm">
          <IconAlert width={16} height={16} className="mt-0.5 shrink-0 text-[var(--color-critical)]" />
          {error}
        </p>
      ) : null}
      {saved ? (
        <p role="status" className="border border-[var(--color-positive)] px-4 py-3 text-sm">
          Réglages enregistrés.
        </p>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        {fields.map((field) =>
          field.multiline ? (
            <TextAreaField
              key={field.key}
              id={field.key}
              label={field.label}
              value={values[field.key] ?? ''}
              hint={field.hint}
              onChange={update(field.key)}
              rows={5}
              className="sm:col-span-2"
            />
          ) : (
            <TextField
              key={field.key}
              id={field.key}
              label={field.label}
              value={values[field.key] ?? ''}
              hint={field.hint}
              error={errors[field.key]?.length ? 'Adresse web invalide (https://…).' : undefined}
              onChange={update(field.key)}
            />
          ),
        )}
      </div>

      <Button type="submit" loading={pending} className="self-start">
        Enregistrer
      </Button>
    </form>
  );
}
