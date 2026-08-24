'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ChoiceRow, SelectField, TextAreaField, TextField } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { IconAlert } from '@/components/ui/icons';
import { placeOrderAction } from '@/modules/orders/actions';
import { addMoney, compareMoney, formatMoney, subtractMoney } from '@/lib/money';
import type { CheckoutOptions } from '@/modules/orders/checkout-options';
import type { PricedLine } from '@/modules/orders/pricing';
import type { AppLocale } from '@/i18n/config';

type Fulfilment = 'DELIVERY' | 'HAND_TO_HAND' | 'STORE_PICKUP';

/**
 * Explicit keys rather than Record<string, string>: with strict index checking a
 * mistyped label would otherwise be `undefined` at runtime and blank on screen.
 */
export type CheckoutLabels = {
  stepContact: string; stepFulfilment: string; stepPayment: string; noteLegend: string;
  email: string; phone: string; phoneHint: string; firstName: string; lastName: string;
  address1: string; address2: string; city: string; governorate: string; postalCode: string;
  note: string; delivery: string; handToHand: string; storePickup: string;
  choosePickupPoint: string;
  payment_cod: string; payment_cop: string; payment_bank_transfer: string; payment_online: string;
  placeOrder: string; placing: string; orderSummary: string; noShippingForZone: string;
  stockChanged: string; acceptTerms: string; subtotal: string; shipping: string; total: string;
  promoCode: string; optional: string; generic: string; validation: string; rateLimited: string;
  outOfStock: string; fieldInvalid: string;
};

const PAYMENT_LABEL_KEYS: Record<string, keyof CheckoutLabels> = {
  cod: 'payment_cod',
  cop: 'payment_cop',
  bank_transfer: 'payment_bank_transfer',
};

/**
 * One page, grouped fieldsets — not a four-step wizard.
 *
 * A BOA order is a handful of fields; a wizard would add three page loads and
 * three chances to abandon. The summary is sticky beside the form on desktop and
 * collapses above the submit button on mobile, so the total is never off-screen
 * when the customer commits.
 *
 * Everything shown here is advisory. The server re-prices the cart, re-checks
 * stock, recomputes shipping from the governorate and re-validates the
 * payment/fulfilment pairing before an order exists.
 */
export function CheckoutForm({
  locale,
  lines,
  subtotal,
  options,
  labels,
  defaults,
  confirmationPath,
}: {
  locale: AppLocale;
  lines: PricedLine[];
  subtotal: string;
  options: CheckoutOptions;
  labels: CheckoutLabels;
  defaults: { email: string; firstName: string; lastName: string; phone: string };
  confirmationPath: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);

  // Generated once per mount: a double submit, or a retry after a dropped
  // connection, resolves to the same order instead of a second one.
  const [idempotencyKey] = useState(() =>
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );

  const [fulfilment, setFulfilment] = useState<Fulfilment>(
    options.pickupPoints.length > 0 && options.governorates.length === 0 ? 'STORE_PICKUP' : 'DELIVERY',
  );
  const [governorate, setGovernorate] = useState('');
  const [pickupPointId, setPickupPointId] = useState(options.pickupPoints[0]?.id ?? '');
  const [payment, setPayment] = useState('');
  const [accepted, setAccepted] = useState(false);

  const paymentChoices = useMemo(
    () => options.paymentKeys.filter((entry) => entry.method === fulfilment).map((entry) => entry.key),
    [options.paymentKeys, fulfilment],
  );

  const activePayment = paymentChoices.includes(payment) ? payment : (paymentChoices[0] ?? '');

  /** Informational only — `quoteShipping` on the server decides what is charged. */
  const shipping = useMemo(() => {
    if (fulfilment === 'STORE_PICKUP') return { price: '0.000', available: true, eta: null as string | null };
    const zone = options.zones.find((candidate) =>
      candidate.governorates.some((g) => g.toLowerCase() === governorate.toLowerCase()),
    );
    if (!zone) return { price: '0.000', available: false, eta: null };
    const free = zone.freeAbove !== null && compareMoney(subtotal, zone.freeAbove) >= 0;
    return { price: free ? '0.000' : zone.price, available: true, eta: zone.etaDays };
  }, [fulfilment, governorate, options.zones, subtotal]);

  const total = addMoney(subtotal, shipping.price);

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await placeOrderAction({
        locale,
        idempotencyKey,
        fulfilment,
        paymentProviderKey: activePayment,
        pickupPointId: fulfilment === 'STORE_PICKUP' ? pickupPointId : '',
        governorate: fulfilment === 'STORE_PICKUP' ? '' : governorate,
        acceptTerms: accepted,
        email: formData.get('email'),
        phone: formData.get('phone'),
        firstName: formData.get('firstName'),
        lastName: formData.get('lastName'),
        addressLine1: formData.get('addressLine1') ?? '',
        addressLine2: formData.get('addressLine2') ?? '',
        city: formData.get('city') ?? '',
        postalCode: formData.get('postalCode') ?? '',
        note: formData.get('note') ?? '',
        discountCode: formData.get('discountCode') ?? '',
      });

      if (result.ok) {
        if (result.data.redirectUrl) window.location.assign(result.data.redirectUrl);
        else router.push(`${confirmationPath}/${result.data.reference}`);
        return;
      }

      setErrors(result.fieldErrors ?? {});
      setFormError(
        result.code === 'out_of_stock'
          ? labels.outOfStock.replace('{name}', result.message)
          : result.code === 'cart_changed'
            ? labels.stockChanged
            : result.code === 'validation_failed'
              ? labels.validation
              : result.code === 'rate_limited'
                ? labels.rateLimited
                : labels.generic,
      );
      // Move focus to the alert so the failure is announced, not just painted.
      document.getElementById('checkout-error')?.focus();
    });
  };

  const errorFor = (field: string) => (errors[field]?.length ? labels.fieldInvalid : undefined);

  return (
    <form onSubmit={submit} noValidate className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-16">
      <div className="flex flex-col gap-12">
        {formError ? (
          <div
            id="checkout-error"
            role="alert"
            tabIndex={-1}
            className="flex items-start gap-3 rounded-md border border-[var(--color-critical)] px-4 py-3 text-sm"
          >
            <IconAlert width={16} height={16} className="mt-0.5 shrink-0 text-[var(--color-critical)]" />
            <span>{formError}</span>
          </div>
        ) : null}

        <fieldset>
          <legend className="lockup mb-6 text-[var(--surface-accent)]">{labels.stepContact}</legend>
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField id="firstName" label={labels.firstName} defaultValue={defaults.firstName} autoComplete="given-name" required error={errorFor('firstName')} />
            <TextField id="lastName" label={labels.lastName} defaultValue={defaults.lastName} autoComplete="family-name" required error={errorFor('lastName')} />
            <TextField id="email" label={labels.email} type="email" inputMode="email" defaultValue={defaults.email} autoComplete="email" required error={errorFor('email')} />
            <TextField id="phone" label={labels.phone} type="tel" inputMode="tel" defaultValue={defaults.phone} autoComplete="tel" required hint={labels.phoneHint} error={errorFor('phone')} />
          </div>
        </fieldset>

        <fieldset>
          <legend className="lockup mb-6 text-[var(--surface-accent)]">{labels.stepFulfilment}</legend>
          <div className="grid gap-3 sm:grid-cols-3">
            {options.governorates.length > 0 ? (
              <>
                <ChoiceRow name="fulfilment" value="DELIVERY" checked={fulfilment === 'DELIVERY'} onChange={(v) => setFulfilment(v as Fulfilment)} title={labels.delivery} />
                <ChoiceRow name="fulfilment" value="HAND_TO_HAND" checked={fulfilment === 'HAND_TO_HAND'} onChange={(v) => setFulfilment(v as Fulfilment)} title={labels.handToHand} />
              </>
            ) : null}
            {options.pickupPoints.length > 0 ? (
              <ChoiceRow name="fulfilment" value="STORE_PICKUP" checked={fulfilment === 'STORE_PICKUP'} onChange={(v) => setFulfilment(v as Fulfilment)} title={labels.storePickup} />
            ) : null}
          </div>

          {fulfilment === 'STORE_PICKUP' ? (
            <div className="mt-6 grid gap-3">
              <p className="lockup text-[var(--surface-muted)]">{labels.choosePickupPoint}</p>
              {options.pickupPoints.map((point) => (
                <ChoiceRow
                  key={point.id}
                  name="pickupPointId"
                  value={point.id}
                  checked={pickupPointId === point.id}
                  onChange={setPickupPointId}
                  title={point.name}
                  description={[point.addressLine, point.city, point.hours].filter(Boolean).join(' · ')}
                />
              ))}
            </div>
          ) : (
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <TextField id="addressLine1" label={labels.address1} autoComplete="address-line1" required error={errorFor('addressLine1')} className="sm:col-span-2" />
              <TextField id="addressLine2" label={labels.address2} autoComplete="address-line2" optional optionalLabel={labels.optional} className="sm:col-span-2" />
              <TextField id="city" label={labels.city} autoComplete="address-level2" required error={errorFor('city')} />
              <SelectField
                id="governorate"
                label={labels.governorate}
                value={governorate}
                onChange={(event) => setGovernorate(event.target.value)}
                required
                error={errorFor('governorate')}
              >
                <option value="">—</option>
                {options.governorates.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </SelectField>
              <TextField id="postalCode" label={labels.postalCode} autoComplete="postal-code" optional optionalLabel={labels.optional} inputMode="numeric" />
            </div>
          )}

          {!shipping.available && fulfilment !== 'STORE_PICKUP' && governorate ? (
            <p role="status" className="mt-4 text-sm text-[var(--color-caution)]">
              {labels.noShippingForZone}
            </p>
          ) : null}
        </fieldset>

        <fieldset>
          <legend className="lockup mb-6 text-[var(--surface-accent)]">{labels.stepPayment}</legend>
          <div className="grid gap-3">
            {paymentChoices.map((key) => (
              <ChoiceRow
                key={key}
                name="payment"
                value={key}
                checked={activePayment === key}
                onChange={setPayment}
                title={labels[PAYMENT_LABEL_KEYS[key] ?? 'payment_online']}
              />
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="lockup mb-6 text-[var(--surface-accent)]">{labels.noteLegend}</legend>
          <TextAreaField id="note" label={labels.note} optional optionalLabel={labels.optional} />
        </fieldset>
      </div>

      <aside className="lg:sticky lg:top-32 lg:self-start">
        <div className="rounded-md border border-[var(--surface-line)] p-6">
          <h2 className="lockup text-[var(--surface-muted)]">{labels.orderSummary}</h2>

          <ul className="mt-6 flex flex-col gap-3 text-sm">
            {lines.map((line) => (
              <li key={line.variantId} className="flex justify-between gap-4">
                <span className="min-w-0">
                  <span className="block truncate">{line.productName}</span>
                  <span className="text-xs text-[var(--surface-muted)]">
                    {line.format} × {line.quantity}
                  </span>
                </span>
                <span className="shrink-0 tabular-nums">{formatMoney(line.lineTotal, locale)}</span>
              </li>
            ))}
          </ul>

          <div className="mt-6 border-t border-[var(--surface-line)] pt-6">
            <TextField id="discountCode" label={labels.promoCode} optional optionalLabel={labels.optional} autoCapitalize="characters" />
          </div>

          <dl className="mt-6 flex flex-col gap-3 border-t border-[var(--surface-line)] pt-6 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--surface-muted)]">{labels.subtotal}</dt>
              <dd className="tabular-nums">{formatMoney(subtotal, locale)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--surface-muted)]">{labels.shipping}</dt>
              <dd className="tabular-nums">
                {shipping.available ? formatMoney(shipping.price, locale) : '—'}
                {shipping.eta ? (
                  <span className="ms-2 text-xs text-[var(--surface-muted)]">{shipping.eta}</span>
                ) : null}
              </dd>
            </div>
          </dl>

          <div className="mt-6 flex justify-between gap-4 border-t border-[var(--surface-line)] pt-6">
            <span className="font-display text-lg">{labels.total}</span>
            <span className="font-display text-lg tabular-nums">{formatMoney(total, locale)}</span>
          </div>

          <label className="mt-6 flex cursor-pointer items-start gap-3 text-xs leading-relaxed">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(event) => setAccepted(event.target.checked)}
              className="mt-0.5 size-4 shrink-0 appearance-none rounded-[4px] border border-[var(--surface-field-line)] checked:border-[var(--surface-fg)] checked:bg-[var(--surface-fg)]"
            />
            <span>{labels.acceptTerms}</span>
          </label>

          <Button
            type="submit"
            size="lg"
            loading={pending}
            disabled={!accepted || !activePayment || lines.length === 0 || (fulfilment !== 'STORE_PICKUP' && !shipping.available)}
            className="mt-6 w-full"
          >
            {pending ? labels.placing : labels.placeOrder}
          </Button>
        </div>
      </aside>
    </form>
  );
}

export { subtractMoney };
