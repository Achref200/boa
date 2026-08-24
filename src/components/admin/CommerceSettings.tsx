'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { SelectField, TextField } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { ConfirmButton } from './ConfirmButton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { IconAlert, IconPlus } from '@/components/ui/icons';
import {
  deleteShippingZoneAction,
  saveDiscountAction,
  saveShippingZoneAction,
  setDiscountActiveAction,
} from '@/modules/admin/actions/commerce';
import { formatMoney } from '@/lib/money';
import { formatDate } from '@/lib/datetime';
import { cn } from '@/lib/cn';

const KIND_FR: Record<string, string> = {
  PERCENTAGE: 'Pourcentage',
  FIXED_AMOUNT: 'Montant fixe',
  FREE_SHIPPING: 'Livraison offerte',
};

export type DiscountRow = {
  id: string;
  code: string;
  kind: string;
  value: string;
  minSubtotal: string | null;
  maxRedemptions: number | null;
  redemptions: number;
  startsAt: Date | null;
  endsAt: Date | null;
  isActive: boolean;
};

type DiscountDraft = {
  id?: string;
  code: string;
  kind: 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FREE_SHIPPING';
  value: string;
  minSubtotal: string;
  maxRedemptions: string;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
};

const blankDiscount = (): DiscountDraft => ({
  code: '',
  kind: 'PERCENTAGE',
  value: '10',
  minSubtotal: '',
  maxRedemptions: '',
  startsAt: '',
  endsAt: '',
  isActive: true,
});

/**
 * A discount is deactivated, not deleted: the orders that used it keep their
 * `discount_code` snapshot, and a deleted code makes those orders unexplainable.
 * The redemption counter is read-only here — the order transaction owns it, and
 * an editable counter would be a way around a usage limit.
 */
export function DiscountManager({ discounts }: { discounts: DiscountRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<DiscountDraft | null>(null);
  const [error, setError] = useState<string | null>(null);

  const save = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft) return;
    setError(null);
    startTransition(async () => {
      const result = await saveDiscountAction({ ...draft, id: draft.id ?? '' });
      if (result.ok) {
        setDraft(null);
        router.refresh();
      } else {
        setError(result.message);
      }
    });
  };

  const toggle = (id: string, isActive: boolean) => {
    startTransition(async () => {
      const result = await setDiscountActiveAction({ id, isActive });
      if (result.ok) router.refresh();
      else setError(result.message);
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {error ? (
        <p role="alert" className="flex items-start gap-3 border border-[var(--color-critical)] bg-[var(--surface-raised)] px-4 py-3 text-sm">
          <IconAlert width={16} height={16} className="mt-0.5 shrink-0 text-[var(--color-critical)]" />
          {error}
        </p>
      ) : null}

      {discounts.length === 0 && !draft ? (
        <p className="rounded-md border border-[var(--surface-line)] bg-[var(--surface-raised)] px-4 py-10 text-center text-sm text-[var(--surface-muted)]">
          Aucun code promotionnel.
        </p>
      ) : null}

      <ul className="flex flex-col gap-3">
        {discounts.map((discount) => (
          <li
            key={discount.id}
            className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-md border border-[var(--surface-line)] bg-[var(--surface-raised)] px-5 py-4"
          >
            <div className="min-w-0">
              <p className="font-medium tabular-nums">{discount.code}</p>
              <p className="text-xs text-[var(--surface-muted)]">
                {KIND_FR[discount.kind] ?? discount.kind}
                {discount.kind === 'PERCENTAGE' ? ` · ${Number(discount.value)} %` : null}
                {discount.kind === 'FIXED_AMOUNT' ? ` · ${formatMoney(discount.value, 'fr')}` : null}
                {discount.minSubtotal ? ` · dès ${formatMoney(discount.minSubtotal, 'fr')}` : ''}
              </p>
            </div>

            <span className="text-xs tabular-nums text-[var(--surface-muted)]">
              {discount.redemptions}
              {discount.maxRedemptions ? ` / ${discount.maxRedemptions}` : ''} utilisation(s)
            </span>

            {discount.startsAt || discount.endsAt ? (
              <span className="text-xs tabular-nums text-[var(--surface-muted)]">
                {discount.startsAt ? formatDate(discount.startsAt) : '…'} →{' '}
                {discount.endsAt ? formatDate(discount.endsAt) : '…'}
              </span>
            ) : null}

            <StatusBadge tone={discount.isActive ? 'positive' : 'neutral'}>
              {discount.isActive ? 'Actif' : 'Inactif'}
            </StatusBadge>

            <div className="ms-auto flex items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  setDraft({
                    id: discount.id,
                    code: discount.code,
                    kind: discount.kind as DiscountDraft['kind'],
                    value: discount.kind === 'PERCENTAGE' ? String(Number(discount.value)) : discount.value,
                    minSubtotal: discount.minSubtotal ?? '',
                    maxRedemptions: discount.maxRedemptions ? String(discount.maxRedemptions) : '',
                    startsAt: discount.startsAt ? discount.startsAt.toISOString().slice(0, 10) : '',
                    endsAt: discount.endsAt ? discount.endsAt.toISOString().slice(0, 10) : '',
                    isActive: discount.isActive,
                  })
                }
                className="min-h-10 text-xs uppercase tracking-[0.12em] underline underline-offset-4"
              >
                Modifier
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => toggle(discount.id, !discount.isActive)}
                className="min-h-10 text-xs uppercase tracking-[0.12em] text-[var(--surface-muted)] underline underline-offset-4 hover:text-[var(--surface-fg)]"
              >
                {discount.isActive ? 'Désactiver' : 'Activer'}
              </button>
            </div>
          </li>
        ))}
      </ul>

      {draft ? (
        <form onSubmit={save} noValidate className="rounded-md border border-[var(--surface-line)] bg-[var(--surface-raised)] p-5">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <TextField
              id="discount-code"
              label="Code"
              value={draft.code}
              onChange={(event) => setDraft({ ...draft, code: event.target.value.toUpperCase() })}
              required
              autoCapitalize="characters"
            />
            <SelectField
              id="discount-kind"
              label="Type"
              value={draft.kind}
              onChange={(event) => setDraft({ ...draft, kind: event.target.value as DiscountDraft['kind'] })}
            >
              <option value="PERCENTAGE">Pourcentage</option>
              <option value="FIXED_AMOUNT">Montant fixe</option>
              <option value="FREE_SHIPPING">Livraison offerte</option>
            </SelectField>
            {draft.kind !== 'FREE_SHIPPING' ? (
              <TextField
                id="discount-value"
                label={draft.kind === 'PERCENTAGE' ? 'Pourcentage' : 'Montant (DT)'}
                value={draft.value}
                onChange={(event) => setDraft({ ...draft, value: event.target.value })}
                inputMode="decimal"
                required
              />
            ) : null}
            <TextField
              id="discount-min"
              label="Panier minimum (DT)"
              value={draft.minSubtotal}
              onChange={(event) => setDraft({ ...draft, minSubtotal: event.target.value })}
              inputMode="decimal"
              optional
              optionalLabel="facultatif"
            />
            <TextField
              id="discount-max"
              label="Nombre d’utilisations"
              value={draft.maxRedemptions}
              onChange={(event) => setDraft({ ...draft, maxRedemptions: event.target.value })}
              inputMode="numeric"
              optional
              optionalLabel="illimité"
            />
            <TextField
              id="discount-start"
              label="Début"
              type="date"
              value={draft.startsAt}
              onChange={(event) => setDraft({ ...draft, startsAt: event.target.value })}
              optional
              optionalLabel="facultatif"
            />
            <TextField
              id="discount-end"
              label="Fin"
              type="date"
              value={draft.endsAt}
              onChange={(event) => setDraft({ ...draft, endsAt: event.target.value })}
              optional
              optionalLabel="facultatif"
            />
          </div>

          <label className="mt-5 flex min-h-11 cursor-pointer items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={draft.isActive}
              onChange={(event) => setDraft({ ...draft, isActive: event.target.checked })}
              className="size-4 appearance-none rounded-[4px] border border-[var(--surface-field-line)] checked:border-[var(--surface-fg)] checked:bg-[var(--surface-fg)]"
            />
            Actif
          </label>

          <div className="mt-6 flex gap-3">
            <Button type="submit" size="sm" loading={pending}>
              Enregistrer
            </Button>
            <button
              type="button"
              onClick={() => setDraft(null)}
              className="min-h-11 px-4 text-xs uppercase tracking-[0.12em] text-[var(--surface-muted)] underline underline-offset-4"
            >
              Annuler
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setDraft(blankDiscount())}
          className="inline-flex min-h-11 items-center gap-2 self-start rounded-full border border-[var(--surface-line)] bg-[var(--surface-raised)] px-4 text-sm font-semibold hover:border-[var(--surface-fg)]"
        >
          <IconPlus width={14} height={14} />
          Nouveau code
        </button>
      )}
    </div>
  );
}

export type ZoneRow = {
  id: string;
  name: string;
  governorates: string[];
  price: string;
  freeAbove: string | null;
  etaDays: string | null;
  isActive: boolean;
  position: number;
};

type ZoneDraft = {
  id?: string;
  name: string;
  governorates: string[];
  price: string;
  freeAbove: string;
  etaDays: string;
  isActive: boolean;
  position: string;
};

/**
 * Delivery zones decide what checkout can charge — and, just as importantly,
 * which governorates get a delivery option at all. A governorate in no zone is
 * offered pickup instead of an invented fee.
 */
export function ShippingZoneManager({
  zones,
  governorates,
}: {
  zones: ZoneRow[];
  governorates: readonly string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<ZoneDraft | null>(null);
  const [error, setError] = useState<string | null>(null);

  const covered = new Set(zones.flatMap((zone) => zone.governorates));
  const uncovered = governorates.filter((name) => !covered.has(name));

  const save = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft) return;
    setError(null);
    startTransition(async () => {
      const result = await saveShippingZoneAction({ ...draft, id: draft.id ?? '' });
      if (result.ok) {
        setDraft(null);
        router.refresh();
      } else {
        setError(result.message);
      }
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {error ? (
        <p role="alert" className="flex items-start gap-3 border border-[var(--color-critical)] bg-[var(--surface-raised)] px-4 py-3 text-sm">
          <IconAlert width={16} height={16} className="mt-0.5 shrink-0 text-[var(--color-critical)]" />
          {error}
        </p>
      ) : null}

      {uncovered.length > 0 ? (
        <p className="border border-[var(--color-caution)] bg-[var(--surface-raised)] px-4 py-3 text-sm">
          Sans zone, donc sans livraison : {uncovered.join(', ')}.
        </p>
      ) : null}

      <ul className="flex flex-col gap-3">
        {zones.map((zone) => (
          <li key={zone.id} className="rounded-md border border-[var(--surface-line)] bg-[var(--surface-raised)] px-5 py-4">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <p className="font-medium">{zone.name}</p>
              <span className="tabular-nums">{formatMoney(zone.price, 'fr')}</span>
              {zone.freeAbove ? (
                <span className="text-xs text-[var(--surface-muted)]">
                  offerte dès {formatMoney(zone.freeAbove, 'fr')}
                </span>
              ) : null}
              {zone.etaDays ? (
                <span className="text-xs text-[var(--surface-muted)]">{zone.etaDays}</span>
              ) : null}
              <StatusBadge tone={zone.isActive ? 'positive' : 'neutral'}>
                {zone.isActive ? 'Active' : 'Inactive'}
              </StatusBadge>

              <div className="ms-auto flex items-center gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setDraft({
                      id: zone.id,
                      name: zone.name,
                      governorates: zone.governorates,
                      price: zone.price,
                      freeAbove: zone.freeAbove ?? '',
                      etaDays: zone.etaDays ?? '',
                      isActive: zone.isActive,
                      position: String(zone.position),
                    })
                  }
                  className="min-h-10 text-xs uppercase tracking-[0.12em] underline underline-offset-4"
                >
                  Modifier
                </button>
                <ConfirmButton
                  label="Supprimer"
                  confirmTitle={`Supprimer la zone « ${zone.name} » ?`}
                  confirmBody="Les gouvernorats de cette zone n’auront plus d’option de livraison au paiement. Les commandes déjà passées conservent le tarif qu’elles ont payé."
                  confirmLabel="Supprimer"
                  onConfirm={() =>
                    startTransition(async () => {
                      const result = await deleteShippingZoneAction({ id: zone.id });
                      if (result.ok) router.refresh();
                      else setError(result.message);
                    })
                  }
                />
              </div>
            </div>
            <p className="mt-2 text-xs text-[var(--surface-muted)]">{zone.governorates.join(' · ')}</p>
          </li>
        ))}
      </ul>

      {draft ? (
        <form onSubmit={save} noValidate className="rounded-md border border-[var(--surface-line)] bg-[var(--surface-raised)] p-5">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <TextField
              id="zone-name"
              label="Nom de la zone"
              value={draft.name}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              required
            />
            <TextField
              id="zone-price"
              label="Tarif (DT)"
              value={draft.price}
              onChange={(event) => setDraft({ ...draft, price: event.target.value })}
              inputMode="decimal"
              required
            />
            <TextField
              id="zone-free"
              label="Offerte à partir de (DT)"
              value={draft.freeAbove}
              onChange={(event) => setDraft({ ...draft, freeAbove: event.target.value })}
              inputMode="decimal"
              optional
              optionalLabel="facultatif"
            />
            <TextField
              id="zone-eta"
              label="Délai indicatif"
              value={draft.etaDays}
              onChange={(event) => setDraft({ ...draft, etaDays: event.target.value })}
              placeholder="48 h"
              optional
              optionalLabel="facultatif"
            />
          </div>

          <fieldset className="mt-6">
            <legend className="lockup mb-3 text-[10px] text-[var(--surface-muted)]">Gouvernorats</legend>
            <ul className="flex flex-wrap gap-2">
              {governorates.map((name) => {
                const checked = draft.governorates.includes(name);
                return (
                  <li key={name}>
                    <label
                      className={cn(
                        'inline-flex min-h-10 cursor-pointer items-center border px-3 text-xs transition-colors',
                        checked
                          ? 'border-[var(--surface-fg)] bg-[var(--surface-fg)] text-[var(--surface-bg)]'
                          : 'border-[var(--surface-line)] hover:border-[var(--surface-fg)]',
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setDraft({
                            ...draft,
                            governorates: checked
                              ? draft.governorates.filter((entry) => entry !== name)
                              : [...draft.governorates, name],
                          })
                        }
                        className="visually-hidden"
                      />
                      {name}
                    </label>
                  </li>
                );
              })}
            </ul>
          </fieldset>

          <label className="mt-5 flex min-h-11 cursor-pointer items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={draft.isActive}
              onChange={(event) => setDraft({ ...draft, isActive: event.target.checked })}
              className="size-4 appearance-none rounded-[4px] border border-[var(--surface-field-line)] checked:border-[var(--surface-fg)] checked:bg-[var(--surface-fg)]"
            />
            Zone active
          </label>

          <div className="mt-6 flex gap-3">
            <Button type="submit" size="sm" loading={pending}>
              Enregistrer
            </Button>
            <button
              type="button"
              onClick={() => setDraft(null)}
              className="min-h-11 px-4 text-xs uppercase tracking-[0.12em] text-[var(--surface-muted)] underline underline-offset-4"
            >
              Annuler
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() =>
            setDraft({
              name: '',
              governorates: [],
              price: '',
              freeAbove: '',
              etaDays: '',
              isActive: true,
              position: String(zones.length),
            })
          }
          className="inline-flex min-h-11 items-center gap-2 self-start rounded-full border border-[var(--surface-line)] bg-[var(--surface-raised)] px-4 text-sm font-semibold hover:border-[var(--surface-fg)]"
        >
          <IconPlus width={14} height={14} />
          Nouvelle zone
        </button>
      )}
    </div>
  );
}
