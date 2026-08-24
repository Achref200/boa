'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { addOrderNote, changeOrderStatus, changePaymentStatus } from '../orders';
import { assertPermission } from '../guard';
import { recordAudit } from '@/modules/audit/service';
import { fail, ok, AppError, type ActionResult } from '@/lib/errors';
import { adminRoutes } from '@/lib/routes';

const ORDER_ERRORS: Record<string, string> = {
  invalid_transition: 'Ce changement de statut n’est pas autorisé depuis l’état actuel.',
  order_not_found: 'Commande introuvable.',
};

export async function changeOrderStatusAction(input: unknown): Promise<ActionResult<null>> {
  const parsed = z
    .object({
      orderId: z.string().trim().length(24),
      status: z.enum([
        'PENDING', 'CONFIRMED', 'PREPARING', 'SHIPPED',
        'READY_FOR_PICKUP', 'COMPLETED', 'CANCELLED', 'REFUNDED',
      ]),
      reason: z.string().trim().max(255).optional(),
    })
    .safeParse(input);
  if (!parsed.success) return fail('validation_failed', 'invalid_request');

  try {
    const admin = await assertPermission(
      parsed.data.status === 'REFUNDED' ? 'order.refund' : 'order.write',
    );
    await changeOrderStatus(parsed.data.orderId, parsed.data.status, admin.id, parsed.data.reason);
    await recordAudit({
      adminId: admin.id,
      action: 'order.status_change',
      entity: 'order',
      entityId: parsed.data.orderId,
      summary: parsed.data.status,
    });
    revalidatePath(adminRoutes.order(parsed.data.orderId));
    revalidatePath(adminRoutes.orders);
    revalidatePath(adminRoutes.root);
    return ok(null);
  } catch (error) {
    if (error instanceof AppError) return fail(error.code, ORDER_ERRORS[error.message] ?? error.message);
    console.error('[admin.order.status]', error);
    return fail('unavailable', 'update_failed');
  }
}

export async function changePaymentStatusAction(input: unknown): Promise<ActionResult<null>> {
  const parsed = z
    .object({
      orderId: z.string().trim().length(24),
      status: z.enum(['UNPAID', 'AUTHORIZED', 'PAID', 'FAILED', 'REFUNDED', 'CANCELLED']),
    })
    .safeParse(input);
  if (!parsed.success) return fail('validation_failed', 'invalid_request');

  try {
    const admin = await assertPermission(
      parsed.data.status === 'REFUNDED' ? 'order.refund' : 'order.write',
    );
    await changePaymentStatus(parsed.data.orderId, parsed.data.status, admin.id);
    await recordAudit({
      adminId: admin.id,
      action: 'order.payment_change',
      entity: 'order',
      entityId: parsed.data.orderId,
      summary: parsed.data.status,
    });
    revalidatePath(adminRoutes.order(parsed.data.orderId));
    return ok(null);
  } catch (error) {
    if (error instanceof AppError) return fail(error.code, ORDER_ERRORS[error.message] ?? error.message);
    console.error('[admin.order.payment]', error);
    return fail('unavailable', 'update_failed');
  }
}

export async function saveOrderNoteAction(input: unknown): Promise<ActionResult<null>> {
  const parsed = z
    .object({ orderId: z.string().trim().length(24), note: z.string().trim().max(2000) })
    .safeParse(input);
  if (!parsed.success) return fail('validation_failed', 'invalid_request');

  try {
    const admin = await assertPermission('order.write');
    await addOrderNote(parsed.data.orderId, parsed.data.note, admin.id);
    revalidatePath(adminRoutes.order(parsed.data.orderId));
    return ok(null);
  } catch (error) {
    if (error instanceof AppError) return fail(error.code, error.message);
    console.error('[admin.order.note]', error);
    return fail('unavailable', 'update_failed');
  }
}
