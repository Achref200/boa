import 'server-only';
import { unstable_cache } from 'next/cache';
import { db } from '@/db/client';
import { withBuildFallback } from '@/db/build-guard';
import { parseJson } from '@/lib/json';
import { dbLocale, type AppLocale } from '@/i18n/config';
import { enabledPaymentProviders } from '@/lib/env';
import { availableProviders } from '@/modules/payments/provider';

export const CHECKOUT_TAG = 'checkout-options';

export type PickupPointView = {
  id: string;
  name: string;
  addressLine: string;
  city: string;
  hours: string | null;
  mapUrl: string | null;
};

export type ShippingZoneView = {
  name: string;
  governorates: string[];
  price: string;
  freeAbove: string | null;
  etaDays: string | null;
};

export type CheckoutOptions = {
  pickupPoints: PickupPointView[];
  zones: ShippingZoneView[];
  governorates: string[];
  paymentKeys: { key: string; method: string }[];
};

async function fetchOptions(locale: AppLocale): Promise<CheckoutOptions> {
  const [points, zones] = await Promise.all([
    db
      .selectFrom('pickup_points as p')
      .leftJoin('pickup_point_translations as t', (join) =>
        join.onRef('t.point_id', '=', 'p.id').on('t.locale', '=', dbLocale(locale)))
      .where('p.is_active', '=', true)
      .select([
        'p.id', 'p.address_line as addressLine', 'p.city', 'p.map_url as mapUrl',
        't.name', 't.hours',
      ])
      .orderBy('p.position')
      .execute(),
    db
      .selectFrom('shipping_zones')
      .select(['name', 'governorates', 'price', 'free_above as freeAbove', 'eta_days as etaDays'])
      .where('is_active', '=', true)
      .orderBy('position')
      .execute(),
  ]);

  const parsedZones: ShippingZoneView[] = zones.map((zone) => ({
    name: zone.name,
    governorates: parseJson<string[]>(zone.governorates, []),
    price: zone.price,
    freeAbove: zone.freeAbove,
    etaDays: zone.etaDays,
  }));

  return {
    pickupPoints: points.map((point) => ({
      id: point.id,
      name: point.name ?? point.city,
      addressLine: point.addressLine,
      city: point.city,
      hours: point.hours,
      mapUrl: point.mapUrl,
    })),
    zones: parsedZones,
    // Only governorates BOA actually delivers to are offered. An unserved
    // governorate is absent from the list rather than accepted and then refused.
    governorates: [...new Set(parsedZones.flatMap((zone) => zone.governorates))].sort((a, b) =>
      a.localeCompare(b, 'fr'),
    ),
    paymentKeys: [],
  };
}

const EMPTY_OPTIONS: CheckoutOptions = { pickupPoints: [], zones: [], governorates: [], paymentKeys: [] };

export async function getCheckoutOptions(locale: AppLocale): Promise<CheckoutOptions> {
  const options = await unstable_cache(
    () => withBuildFallback(EMPTY_OPTIONS, () => fetchOptions(locale)),
    ['checkout-options', locale],
    {
      tags: [CHECKOUT_TAG],
      revalidate: 600,
    },
  )();

  return {
    ...options,
    // Availability depends on fulfilment, so the client is given every enabled
    // provider plus the fulfilment methods each supports and filters as the
    // customer chooses. The server re-checks the pairing at order creation.
    paymentKeys: enabledPaymentProviders
      .flatMap((key) =>
        (['DELIVERY', 'HAND_TO_HAND', 'STORE_PICKUP'] as const).map((fulfilment) => ({
          key,
          fulfilment,
          available: availableProviders([key], fulfilment).length > 0,
        })),
      )
      .filter((entry) => entry.available)
      .map((entry) => ({ key: entry.key, method: entry.fulfilment })),
  };
}
