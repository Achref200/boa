'use server';

import { z } from 'zod';
import { revalidatePath, revalidateTag } from 'next/cache';
import {
  deleteShippingZone,
  saveDiscount,
  saveShippingZone,
  setDiscountActive,
} from '../commerce-settings';
import { assertPermission } from '../guard';
import { recordAudit } from '@/modules/audit/service';
import { CHECKOUT_TAG } from '@/modules/orders/checkout-options';
import { fail, ok, AppError, type ActionResult } from '@/lib/errors';
import { adminRoutes } from '@/lib/routes';

const money = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,3})?$/, 'invalid_price')
  .transform((value) => {
    const [whole = '0', fraction = ''] = value.split('.');
    return `${whole}.${fraction.padEnd(3, '0')}`;
  });

const optionalMoney = z
  .union([money, z.literal(''), z.null()]).optional()
  .transform((value) => value || null);

const optionalDate = z
  .union([z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal(''), z.null()]).optional()
  .transform((value) => (value ? new Date(`${value}T00:00:00.000Z`) : null));

const discountSchema = z.object({
  id: z.union([z.string().trim().length(24), z.literal('')]).optional().transform((v) => v || undefined),
  code: z.string().trim().min(3).max(40).regex(/^[A-Za-z0-9_-]+$/, 'invalid_code'),
  kind: z.enum(['PERCENTAGE', 'FIXED_AMOUNT', 'FREE_SHIPPING']),
  value: z.union([money, z.literal('')]).transform((v) => v || '0.000'),
  minSubtotal: optionalMoney,
  maxRedemptions: z
    .union([z.coerce.number().int().min(1).max(1_000_000), z.literal(''), z.null()]).optional()
    .transform((v) => (typeof v === 'number' ? v : null)),
  startsAt: optionalDate,
  endsAt: optionalDate,
  isActive: z.coerce.boolean(),
});

export async function saveDiscountAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = discountSchema.safeParse(input);
  if (!parsed.success) return fail('validation_failed', 'Vérifiez les champs signalés.');

  if (parsed.data.kind === 'PERCENTAGE' && Number(parsed.data.value) > 100) {
    return fail('validation_failed', 'Un pourcentage ne peut pas dépasser 100.');
  }

  try {
    const admin = await assertPermission('discount.write');
    const id = await saveDiscount(parsed.data);
    await recordAudit({
      adminId: admin.id,
      action: 'discount.save',
      entity: 'discount',
      entityId: id,
      summary: parsed.data.code,
    });
    revalidatePath(adminRoutes.discounts);
    return ok({ id });
  } catch (error) {
    if (error instanceof AppError) {
      return fail(error.code, error.message === 'code_taken' ? 'Ce code existe déjà.' : error.message);
    }
    console.error('[admin.discount.save]', error);
    return fail('unavailable', 'save_failed');
  }
}

export async function setDiscountActiveAction(input: unknown): Promise<ActionResult<null>> {
  const parsed = z
    .object({ id: z.string().trim().length(24), isActive: z.coerce.boolean() })
    .safeParse(input);
  if (!parsed.success) return fail('validation_failed', 'invalid_request');

  try {
    const admin = await assertPermission('discount.write');
    await setDiscountActive(parsed.data.id, parsed.data.isActive);
    await recordAudit({
      adminId: admin.id,
      action: 'discount.toggle',
      entity: 'discount',
      entityId: parsed.data.id,
      summary: parsed.data.isActive ? 'activé' : 'désactivé',
    });
    revalidatePath(adminRoutes.discounts);
    return ok(null);
  } catch (error) {
    if (error instanceof AppError) return fail(error.code, error.message);
    return fail('unavailable', 'update_failed');
  }
}

const zoneSchema = z.object({
  id: z.union([z.string().trim().length(24), z.literal('')]).optional().transform((v) => v || undefined),
  name: z.string().trim().min(2).max(120),
  governorates: z.array(z.string().trim().min(2).max(90)).min(1).max(24),
  price: money,
  freeAbove: optionalMoney,
  etaDays: z.string().trim().max(40).nullish().transform((v) => v || null),
  isActive: z.coerce.boolean(),
  position: z.coerce.number().int().min(0).max(99),
});

export async function saveShippingZoneAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = zoneSchema.safeParse(input);
  if (!parsed.success) return fail('validation_failed', 'Vérifiez les champs signalés.');

  try {
    const admin = await assertPermission('shipping.write');
    const id = await saveShippingZone(parsed.data);
    await recordAudit({
      adminId: admin.id,
      action: 'shipping.save',
      entity: 'shipping_zone',
      entityId: id,
      summary: parsed.data.name,
    });
    revalidateTag(CHECKOUT_TAG);
    revalidatePath(adminRoutes.shipping);
    return ok({ id });
  } catch (error) {
    if (error instanceof AppError) return fail(error.code, error.message);
    console.error('[admin.shipping.save]', error);
    return fail('unavailable', 'save_failed');
  }
}

export async function deleteShippingZoneAction(input: unknown): Promise<ActionResult<null>> {
  const parsed = z.object({ id: z.string().trim().length(24) }).safeParse(input);
  if (!parsed.success) return fail('validation_failed', 'invalid_request');

  try {
    const admin = await assertPermission('shipping.write');
    await deleteShippingZone(parsed.data.id);
    await recordAudit({
      adminId: admin.id,
      action: 'shipping.delete',
      entity: 'shipping_zone',
      entityId: parsed.data.id,
    });
    revalidateTag(CHECKOUT_TAG);
    revalidatePath(adminRoutes.shipping);
    return ok(null);
  } catch (error) {
    if (error instanceof AppError) return fail(error.code, error.message);
    return fail('unavailable', 'delete_failed');
  }
}

export async function setInquiryHandledAction(input: unknown): Promise<ActionResult<null>> {
  const parsed = z
    .object({ id: z.string().trim().length(24), handled: z.coerce.boolean() })
    .safeParse(input);
  if (!parsed.success) return fail('validation_failed', 'invalid_request');

  try {
    await assertPermission('content.write');
    const { setInquiryHandled } = await import('../people');
    await setInquiryHandled(parsed.data.id, parsed.data.handled);
    revalidatePath(adminRoutes.inquiries);
    revalidatePath(adminRoutes.root);
    return ok(null);
  } catch (error) {
    if (error instanceof AppError) return fail(error.code, error.message);
    return fail('unavailable', 'update_failed');
  }
}
