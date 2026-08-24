'use server';

import { z } from 'zod';
import { revalidatePath, revalidateTag } from 'next/cache';
import { archiveRitual, saveRitual } from '../rituals';
import { assertPermission } from '../guard';
import { recordAudit } from '@/modules/audit/service';
import { CATALOG_TAG } from '@/modules/catalog/service';
import { fail, ok, AppError, type ActionResult } from '@/lib/errors';
import { adminRoutes } from '@/lib/routes';

const RITUAL_ERRORS: Record<string, string> = {
  slug_taken: 'Ce slug est déjà utilisé par un autre rituel.',
  at_least_one_step: 'Un rituel doit contenir au moins une étape.',
  invalid_slug: 'Utilisez des minuscules, des chiffres et des tirets.',
};

const schema = z.object({
  id: z.union([z.string().trim().length(24), z.literal('')]).optional().transform((v) => v || undefined),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(2)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'invalid_slug'),
  state: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']),
  position: z.coerce.number().int().min(0).max(999),
  translations: z
    .array(
      z.object({
        locale: z.enum(['FR', 'EN', 'AR']),
        name: z.string().trim().min(1).max(160),
        intro: z.string().trim().max(4000).nullish().transform((v) => v || null),
      }),
    )
    .min(1)
    .max(3),
  steps: z
    .array(
      z.object({
        productId: z
          .union([z.string().trim().length(24), z.literal(''), z.null()]).optional()
          .transform((v) => v || null),
        titles: z
          .array(
            z.object({
              locale: z.enum(['FR', 'EN', 'AR']),
              title: z.string().trim().max(160),
              body: z.string().trim().max(4000).nullish().transform((v) => v || null),
            }),
          )
          .max(3),
      }),
    )
    .min(1)
    .max(10),
});

export async function saveRitualAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return fail('validation_failed', RITUAL_ERRORS[first?.message ?? ''] ?? 'Vérifiez les champs signalés.');
  }

  try {
    const admin = await assertPermission('catalog.write');
    const id = await saveRitual(parsed.data);
    await recordAudit({
      adminId: admin.id,
      action: 'ritual.save',
      entity: 'ritual',
      entityId: id,
      summary: parsed.data.translations[0]?.name ?? parsed.data.slug,
    });
    revalidateTag(CATALOG_TAG);
    revalidatePath('/', 'layout');
    revalidatePath(adminRoutes.rituals);
    return ok({ id });
  } catch (error) {
    if (error instanceof AppError) return fail(error.code, RITUAL_ERRORS[error.message] ?? error.message);
    console.error('[admin.ritual.save]', error);
    return fail('unavailable', 'save_failed');
  }
}

export async function archiveRitualAction(input: unknown): Promise<ActionResult<null>> {
  const parsed = z.object({ id: z.string().trim().length(24) }).safeParse(input);
  if (!parsed.success) return fail('validation_failed', 'invalid_request');

  try {
    const admin = await assertPermission('catalog.write');
    await archiveRitual(parsed.data.id);
    await recordAudit({
      adminId: admin.id,
      action: 'ritual.archive',
      entity: 'ritual',
      entityId: parsed.data.id,
    });
    revalidateTag(CATALOG_TAG);
    revalidatePath(adminRoutes.rituals);
    return ok(null);
  } catch (error) {
    if (error instanceof AppError) return fail(error.code, error.message);
    return fail('unavailable', 'archive_failed');
  }
}
