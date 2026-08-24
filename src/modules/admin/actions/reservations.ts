'use server';

import { z } from 'zod';
import { revalidatePath, revalidateTag } from 'next/cache';
import {
  changeReservationStatus,
  removeAvailabilityException,
  setAvailabilityException,
} from '../reservations';
import { assertPermission } from '../guard';
import { recordAudit } from '@/modules/audit/service';
import { SERVICES_TAG } from '@/modules/reservations/catalog';
import { fail, ok, AppError, type ActionResult } from '@/lib/errors';
import { adminRoutes } from '@/lib/routes';

const RESERVATION_ERRORS: Record<string, string> = {
  invalid_transition: 'Ce changement de statut n’est pas autorisé depuis l’état actuel.',
  reservation_not_found: 'Réservation introuvable.',
};

export async function changeReservationStatusAction(input: unknown): Promise<ActionResult<null>> {
  const parsed = z
    .object({
      id: z.string().trim().length(24),
      status: z.enum(['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW']),
      reason: z.string().trim().max(255).optional(),
    })
    .safeParse(input);
  if (!parsed.success) return fail('validation_failed', 'invalid_request');

  try {
    const admin = await assertPermission('reservation.write');
    await changeReservationStatus(parsed.data.id, parsed.data.status, parsed.data.reason);
    await recordAudit({
      adminId: admin.id,
      action: 'reservation.status_change',
      entity: 'reservation',
      entityId: parsed.data.id,
      summary: parsed.data.status,
    });
    revalidatePath(adminRoutes.reservations);
    revalidatePath(adminRoutes.root);
    return ok(null);
  } catch (error) {
    if (error instanceof AppError) {
      return fail(error.code, RESERVATION_ERRORS[error.message] ?? error.message);
    }
    console.error('[admin.reservation.status]', error);
    return fail('unavailable', 'update_failed');
  }
}

export async function setAvailabilityExceptionAction(input: unknown): Promise<ActionResult<null>> {
  const parsed = z
    .object({
      serviceId: z.string().trim().length(24),
      date: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'invalid_date'),
      isOpen: z.coerce.boolean(),
      startMin: z.coerce.number().int().min(0).max(1440).nullish(),
      endMin: z.coerce.number().int().min(0).max(1440).nullish(),
      reason: z.string().trim().max(160).nullish(),
    })
    .refine((value) => !value.isOpen || (value.startMin !== null && value.endMin !== null), {
      message: 'window_required',
    })
    .safeParse(input);
  if (!parsed.success) return fail('validation_failed', 'invalid_request');

  try {
    const admin = await assertPermission('reservation.write');
    await setAvailabilityException(parsed.data);
    await recordAudit({
      adminId: admin.id,
      action: 'availability.exception',
      entity: 'service',
      entityId: parsed.data.serviceId,
      summary: `${parsed.data.date} ${parsed.data.isOpen ? 'ouverture' : 'fermeture'}`,
    });
    revalidateTag(SERVICES_TAG);
    revalidatePath(adminRoutes.services);
    return ok(null);
  } catch (error) {
    if (error instanceof AppError) return fail(error.code, error.message);
    console.error('[admin.availability.set]', error);
    return fail('unavailable', 'update_failed');
  }
}

export async function removeAvailabilityExceptionAction(input: unknown): Promise<ActionResult<null>> {
  const parsed = z
    .object({
      serviceId: z.string().trim().length(24),
      date: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/),
    })
    .safeParse(input);
  if (!parsed.success) return fail('validation_failed', 'invalid_request');

  try {
    const admin = await assertPermission('reservation.write');
    await removeAvailabilityException(parsed.data.serviceId, parsed.data.date);
    await recordAudit({
      adminId: admin.id,
      action: 'availability.exception_removed',
      entity: 'service',
      entityId: parsed.data.serviceId,
      summary: parsed.data.date,
    });
    revalidateTag(SERVICES_TAG);
    revalidatePath(adminRoutes.services);
    return ok(null);
  } catch (error) {
    if (error instanceof AppError) return fail(error.code, error.message);
    console.error('[admin.availability.remove]', error);
    return fail('unavailable', 'update_failed');
  }
}
