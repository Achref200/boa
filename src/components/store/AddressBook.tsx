'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { SelectField, TextField } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { IconAlert, IconPlus } from '@/components/ui/icons';
import { deleteAddressAction, saveAddressAction } from '@/modules/identity/account-actions';

export type AddressRow = {
  id: string;
  label: string | null;
  firstName: string;
  lastName: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  governorate: string;
  postalCode: string | null;
  isDefault: boolean;
};

type Labels = {
  add: string;
  edit: string;
  remove: string;
  save: string;
  cancel: string;
  none: string;
  default: string;
  label: string;
  firstName: string;
  lastName: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  governorate: string;
  postalCode: string;
  optional: string;
  generic: string;
  validation: string;
  fieldInvalid: string;
};

const EMPTY: Omit<AddressRow, 'id'> & { id?: string } = {
  label: '',
  firstName: '',
  lastName: '',
  phone: '',
  line1: '',
  line2: '',
  city: '',
  governorate: '',
  postalCode: '',
  isDefault: false,
};

export function AddressBook({
  addresses,
  governorates,
  labels,
}: {
  addresses: AddressRow[];
  governorates: string[];
  labels: Labels;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<(Partial<AddressRow> & { id?: string }) | null>(null);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing) return;
    setError(null);
    const data = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await saveAddressAction({
        id: editing.id ?? '',
        label: data.get('label') ?? '',
        firstName: data.get('firstName'),
        lastName: data.get('lastName'),
        phone: data.get('phone'),
        line1: data.get('line1'),
        line2: data.get('line2') ?? '',
        city: data.get('city'),
        governorate: data.get('governorate'),
        postalCode: data.get('postalCode') ?? '',
        isDefault: data.get('isDefault') === 'on',
      });

      if (result.ok) {
        setEditing(null);
        setErrors({});
        router.refresh();
        return;
      }
      setErrors(result.fieldErrors ?? {});
      setError(result.code === 'validation_failed' ? labels.validation : labels.generic);
    });
  };

  const remove = (id: string) => {
    startTransition(async () => {
      const result = await deleteAddressAction({ id });
      if (result.ok) router.refresh();
      else setError(labels.generic);
    });
  };

  const errorFor = (field: string) => (errors[field]?.length ? labels.fieldInvalid : undefined);

  return (
    <div className="flex flex-col gap-8">
      {error ? (
        <p role="alert" className="flex items-start gap-3 rounded-md border border-[var(--color-critical)] px-4 py-3 text-sm">
          <IconAlert width={16} height={16} className="mt-0.5 shrink-0 text-[var(--color-critical)]" />
          {error}
        </p>
      ) : null}

      {addresses.length === 0 && !editing ? (
        <p className="text-sm text-[var(--surface-muted)]">{labels.none}</p>
      ) : null}

      <ul className="flex flex-col gap-4">
        {addresses.map((address) => (
          <li key={address.id} className="rounded-md border border-[var(--surface-line)] p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <address className="text-sm not-italic leading-relaxed">
                {address.label ? (
                  <span className="lockup mb-2 block text-[var(--surface-muted)]">{address.label}</span>
                ) : null}
                <span className="block">
                  {address.firstName} {address.lastName}
                </span>
                <span className="block">{address.line1}</span>
                {address.line2 ? <span className="block">{address.line2}</span> : null}
                <span className="block">
                  {[address.postalCode, address.city, address.governorate].filter(Boolean).join(' ')}
                </span>
                <span className="mt-1 block text-[var(--surface-muted)]">{address.phone}</span>
              </address>

              <div className="flex flex-col items-end gap-2">
                {address.isDefault ? (
                  <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-gold-deep)]">
                    {labels.default}
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={() => setEditing(address)}
                  className="min-h-11 text-xs uppercase tracking-[0.12em] underline underline-offset-4"
                >
                  {labels.edit}
                </button>
                <button
                  type="button"
                  onClick={() => remove(address.id)}
                  disabled={pending}
                  className="min-h-11 text-xs uppercase tracking-[0.12em] text-[var(--surface-muted)] underline underline-offset-4 hover:text-[var(--color-critical)]"
                >
                  {labels.remove}
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {editing ? (
        <form onSubmit={submit} noValidate className="grid gap-5 rounded-md border border-[var(--surface-line)] p-5 sm:grid-cols-2">
          <TextField id="label" label={labels.label} defaultValue={editing.label ?? ''} optional optionalLabel={labels.optional} />
          <div className="hidden sm:block" />
          <TextField id="firstName" label={labels.firstName} defaultValue={editing.firstName ?? ''} required error={errorFor('firstName')} />
          <TextField id="lastName" label={labels.lastName} defaultValue={editing.lastName ?? ''} required error={errorFor('lastName')} />
          <TextField id="phone" label={labels.phone} type="tel" defaultValue={editing.phone ?? ''} required error={errorFor('phone')} />
          <TextField id="postalCode" label={labels.postalCode} defaultValue={editing.postalCode ?? ''} optional optionalLabel={labels.optional} />
          <TextField id="line1" label={labels.line1} defaultValue={editing.line1 ?? ''} required className="sm:col-span-2" error={errorFor('line1')} />
          <TextField id="line2" label={labels.line2} defaultValue={editing.line2 ?? ''} optional optionalLabel={labels.optional} className="sm:col-span-2" />
          <TextField id="city" label={labels.city} defaultValue={editing.city ?? ''} required error={errorFor('city')} />
          <SelectField id="governorate" label={labels.governorate} defaultValue={editing.governorate ?? ''} required error={errorFor('governorate')}>
            <option value="">—</option>
            {governorates.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </SelectField>

          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm sm:col-span-2">
            <input
              type="checkbox"
              name="isDefault"
              defaultChecked={editing.isDefault ?? false}
              className="size-4 appearance-none rounded-[4px] border border-[var(--surface-field-line)] checked:border-[var(--surface-fg)] checked:bg-[var(--surface-fg)]"
            />
            {labels.default}
          </label>

          <div className="flex gap-3 sm:col-span-2">
            <Button type="submit" loading={pending}>
              {labels.save}
            </Button>
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="min-h-11 px-4 text-xs uppercase tracking-[0.12em] text-[var(--surface-muted)] underline underline-offset-4"
            >
              {labels.cancel}
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setEditing({ ...EMPTY })}
          className="inline-flex min-h-11 items-center gap-2 self-start rounded-full border border-[var(--surface-line)] px-4 text-sm font-semibold hover:border-[var(--surface-fg)]"
        >
          <IconPlus width={14} height={14} />
          {labels.add}
        </button>
      )}
    </div>
  );
}
