'use server';

import { z } from 'zod';
import { revalidatePath, revalidateTag } from 'next/cache';
import { archiveTaxonomy, saveTaxonomy } from '../taxonomy-crud';
import { assertPermission } from '../guard';
import { recordAudit } from '@/modules/audit/service';
import { CATALOG_TAG } from '@/modules/catalog/service';
import { fail, ok, AppError, type ActionResult } from '@/lib/errors';

const TAXONOMY_ERRORS: Record<string, string> = {
  slug_taken: 'Ce slug est déjà utilisé.',
  invalid_slug: 'Utilisez des minuscules, des chiffres et des tirets.',
  category_cannot_parent_itself: 'Une catégorie ne peut pas être sa propre parente.',
};

const schema = z.object({
  kind: z.enum(['categories', 'needs', 'collections']),
  id: z.union([z.string().trim().length(24), z.literal('')]).optional().transform((v) => v || undefined),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(2)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'invalid_slug'),
  position: z.coerce.number().int().min(0).max(999),
  state: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']),
  parentId: z
    .union([z.string().trim().length(24), z.literal(''), z.null()]).optional()
    .transform((v) => v || null),
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
});

export async function saveTaxonomyAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      (fieldErrors[issue.path.join('.') || 'form'] ??= []).push(issue.message);
    }
    return fail('validation_failed', fieldErrors.slug?.[0] ?? 'invalid_request', fieldErrors);
  }

  try {
    const admin = await assertPermission('catalog.write');
    const { kind, ...data } = parsed.data;
    const id = await saveTaxonomy(kind, data);

    await recordAudit({
      adminId: admin.id,
      action: `${kind}.save`,
      entity: kind,
      entityId: id,
      summary: data.translations[0]?.name ?? data.slug,
    });

    revalidateTag(CATALOG_TAG);
    revalidatePath('/', 'layout');
    return ok({ id });
  } catch (error) {
    if (error instanceof AppError) {
      return fail(error.code, TAXONOMY_ERRORS[error.message] ?? error.message);
    }
    console.error('[admin.taxonomy.save]', error);
    return fail('unavailable', 'save_failed');
  }
}

export async function archiveTaxonomyAction(input: unknown): Promise<ActionResult<null>> {
  const parsed = z
    .object({ kind: z.enum(['categories', 'needs', 'collections']), id: z.string().trim().length(24) })
    .safeParse(input);
  if (!parsed.success) return fail('validation_failed', 'invalid_request');

  try {
    const admin = await assertPermission('catalog.write');
    await archiveTaxonomy(parsed.data.kind, parsed.data.id);
    await recordAudit({
      adminId: admin.id,
      action: `${parsed.data.kind}.archive`,
      entity: parsed.data.kind,
      entityId: parsed.data.id,
    });
    revalidateTag(CATALOG_TAG);
    revalidatePath('/', 'layout');
    return ok(null);
  } catch (error) {
    if (error instanceof AppError) return fail(error.code, error.message);
    console.error('[admin.taxonomy.archive]', error);
    return fail('unavailable', 'archive_failed');
  }
}
