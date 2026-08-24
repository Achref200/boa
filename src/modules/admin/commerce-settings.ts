import 'server-only';
import { db } from '@/db/client';
import { newId } from '@/lib/ids';
import { parseJson, toJsonColumn } from '@/lib/json';
import { AppError } from '@/lib/errors';

/** Discount codes and delivery zones — the two commercial levers BOA controls itself. */
export async function listDiscounts() {
  return db
    .selectFrom('discounts')
    .select([
      'id', 'code', 'kind', 'value', 'min_subtotal as minSubtotal',
      'max_redemptions as maxRedemptions', 'redemptions',
      'starts_at as startsAt', 'ends_at as endsAt', 'is_active as isActive',
    ])
    .orderBy('created_at', 'desc')
    .limit(200)
    .execute();
}

export type DiscountInput = {
  id?: string | undefined;
  code: string;
  kind: 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FREE_SHIPPING';
  value: string;
  minSubtotal: string | null;
  maxRedemptions: number | null;
  startsAt: Date | null;
  endsAt: Date | null;
  isActive: boolean;
};

export async function saveDiscount(input: DiscountInput): Promise<string> {
  const id = input.id ?? newId();
  const code = input.code.trim().toUpperCase();

  const clash = await db
    .selectFrom('discounts')
    .select('id')
    .where('code', '=', code)
    .where('id', '!=', id)
    .executeTakeFirst();
  if (clash) throw new AppError('conflict', 'code_taken');

  const values = {
    code,
    kind: input.kind,
    value: input.kind === 'FREE_SHIPPING' ? '0.000' : input.value,
    min_subtotal: input.minSubtotal,
    max_redemptions: input.maxRedemptions,
    starts_at: input.startsAt,
    ends_at: input.endsAt,
    is_active: input.isActive,
  };

  if (input.id) {
    await db.updateTable('discounts').set(values).where('id', '=', id).execute();
  } else {
    // `redemptions` is never settable from the admin: it is a counter the order
    // transaction owns, and an editable one would let a limit be bypassed.
    await db.insertInto('discounts').values({ id, ...values }).execute();
  }
  return id;
}

export async function setDiscountActive(id: string, isActive: boolean): Promise<void> {
  await db.updateTable('discounts').set({ is_active: isActive }).where('id', '=', id).execute();
}

export async function listShippingZones() {
  const rows = await db
    .selectFrom('shipping_zones')
    .select([
      'id', 'name', 'governorates', 'price', 'free_above as freeAbove',
      'eta_days as etaDays', 'is_active as isActive', 'position',
    ])
    .orderBy('position')
    .execute();

  return rows.map((row) => ({
    ...row,
    governorates: parseJson<string[]>(row.governorates, []),
  }));
}

export type ShippingZoneInput = {
  id?: string | undefined;
  name: string;
  governorates: string[];
  price: string;
  freeAbove: string | null;
  etaDays: string | null;
  isActive: boolean;
  position: number;
};

export async function saveShippingZone(input: ShippingZoneInput): Promise<string> {
  const id = input.id ?? newId();
  const values = {
    name: input.name,
    governorates: toJsonColumn(input.governorates),
    price: input.price,
    free_above: input.freeAbove,
    eta_days: input.etaDays,
    is_active: input.isActive,
    position: input.position,
  };

  if (input.id) {
    await db.updateTable('shipping_zones').set(values).where('id', '=', id).execute();
  } else {
    await db.insertInto('shipping_zones').values({ id, ...values }).execute();
  }
  return id;
}

export async function deleteShippingZone(id: string): Promise<void> {
  // Zones carry no historical reference — an order snapshots its shipping cost —
  // so a hard delete is safe here in a way it is not for products.
  await db.deleteFrom('shipping_zones').where('id', '=', id).execute();
}

/** The 24 Tunisian governorates, so a zone is built by picking, not by typing. */
export const TUNISIAN_GOVERNORATES = [
  'Ariana', 'Béja', 'Ben Arous', 'Bizerte', 'Gabès', 'Gafsa', 'Jendouba', 'Kairouan',
  'Kasserine', 'Kébili', 'Le Kef', 'Mahdia', 'Manouba', 'Médenine', 'Monastir', 'Nabeul',
  'Sfax', 'Sidi Bouzid', 'Siliana', 'Sousse', 'Tataouine', 'Tozeur', 'Tunis', 'Zaghouan',
] as const;
