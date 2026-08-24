'use server';

import { z } from 'zod';
import { revalidatePath, revalidateTag } from 'next/cache';
import { archiveService, saveService } from '../services';
import { assertPermission } from '../guard';
import { recordAudit } from '@/modules/audit/service';
import { SERVICES_TAG } from '@/modules/reservations/catalog';
import { generateSlots } from '@/modules/reservations/availability';
import { fail, ok, AppError, type ActionResult } from '@/lib/errors';
import { adminRoutes } from '@/lib/routes';

const SERVICE_ERRORS: Record<string, string> = {
  slug_taken: 'Ce slug est déjà utilisé par un autre service.',
  service_has_upcoming_reservations:
    'Ce service a des réservations à venir. Annulez-les ou attendez qu’elles soient honorées avant d’archiver.',
};

const optionalMoney = z
  .union([
    z.string().trim().regex(/^\d+(\.\d{1,3})?$/, 'invalid_price'),
    z.literal(''),
    z.null(),
  ]).optional()
  .transform((value) => {
    if (!value) return null;
    const [whole = '0', fraction = ''] = value.split('.');
    return `${whole}.${fraction.padEnd(3, '0')}`;
  });

const serviceSchema = z.object({
  id: z.union([z.string().trim().length(24), z.literal('')]).optional().transform((v) => v || undefined),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(2)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'invalid_slug'),
  state: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']),
  durationMin: z.coerce.number().int().min(5).max(600),
  capacity: z.coerce.number().int().min(1).max(50),
  price: optionalMoney,
  bufferMin: z.coerce.number().int().min(0).max(240),
  leadTimeHours: z.coerce.number().int().min(0).max(720),
  horizonDays: z.coerce.number().int().min(1).max(180),
  locationId: z
    .union([z.string().trim().length(24), z.literal(''), z.null()]).optional()
    .transform((v) => v || null),
  position: z.coerce.number().int().min(0).max(999),
  translations: z
    .array(
      z.object({
        locale: z.enum(['FR', 'EN', 'AR']),
        name: z.string().trim().min(1).max(190),
        tagline: z.string().trim().max(255).nullish().transform((v) => v || null),
        description: z.string().trim().max(8000).nullish().transform((v) => v || null),
        preparation: z.string().trim().max(4000).nullish().transform((v) => v || null),
      }),
    )
    .min(1)
    .max(3),
  rules: z
    .array(
      z.object({
        weekday: z.coerce.number().int().min(0).max(6),
        startMin: z.coerce.number().int().min(0).max(1439),
        endMin: z.coerce.number().int().min(1).max(1440),
        slotEveryMin: z.coerce.number().int().min(15).max(480),
      }),
    )
    .max(30)
    .default([])
    .refine((rules) => rules.every((rule) => rule.endMin > rule.startMin), {
      message: 'window_inverted',
    }),
});

export async function saveServiceAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = serviceSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      (fieldErrors[issue.path.join('.') || 'form'] ??= []).push(issue.message);
    }
    return fail('validation_failed', 'invalid_service', fieldErrors);
  }

  try {
    const admin = await assertPermission('service.write');
    const id = await saveService(parsed.data);

    // Materialise the horizon immediately so the booking calendar reflects the
    // new rules without waiting for the first visitor to trigger generation.
    if (parsed.data.state === 'PUBLISHED') await generateSlots(id);

    await recordAudit({
      adminId: admin.id,
      action: parsed.data.id ? 'service.update' : 'service.create',
      entity: 'service',
      entityId: id,
      summary: parsed.data.translations[0]?.name ?? parsed.data.slug,
    });

    revalidateTag(SERVICES_TAG);
    revalidatePath('/', 'layout');
    revalidatePath(adminRoutes.services);
    return ok({ id });
  } catch (error) {
    if (error instanceof AppError) return fail(error.code, SERVICE_ERRORS[error.message] ?? error.message);
    console.error('[admin.service.save]', error);
    return fail('unavailable', 'save_failed');
  }
}

export async function archiveServiceAction(input: unknown): Promise<ActionResult<null>> {
  const parsed = z.object({ id: z.string().trim().length(24) }).safeParse(input);
  if (!parsed.success) return fail('validation_failed', 'invalid_request');

  try {
    const admin = await assertPermission('service.write');
    await archiveService(parsed.data.id);
    await recordAudit({
      adminId: admin.id,
      action: 'service.archive',
      entity: 'service',
      entityId: parsed.data.id,
    });
    revalidateTag(SERVICES_TAG);
    revalidatePath(adminRoutes.services);
    return ok(null);
  } catch (error) {
    if (error instanceof AppError) return fail(error.code, SERVICE_ERRORS[error.message] ?? error.message);
    console.error('[admin.service.archive]', error);
    return fail('unavailable', 'archive_failed');
  }
}
