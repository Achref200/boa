'use server';

import { z } from 'zod';
import { revalidatePath, revalidateTag } from 'next/cache';
import { saveContentBlock, saveSettings } from '../content';
import { assertPermission } from '../guard';
import { recordAudit } from '@/modules/audit/service';
import { CONTENT_TAG } from '@/modules/content/service';
import { fail, ok, AppError, type ActionResult } from '@/lib/errors';
import { adminRoutes } from '@/lib/routes';

const nullableText = (max: number) =>
  z.string().trim().max(max).nullish().transform((value) => value || null);

const blockSchema = z.object({
  id: z.string().trim().length(24),
  isVisible: z.coerce.boolean(),
  position: z.coerce.number().int().min(0).max(99),
  productSlug: z.string().trim().max(160).nullish().transform((v) => v || null),
  translations: z
    .array(
      z.object({
        locale: z.enum(['FR', 'EN', 'AR']),
        eyebrow: nullableText(120),
        heading: nullableText(255),
        body: nullableText(5000),
        ctaLabel: nullableText(80),
        ctaHref: nullableText(255),
      }),
    )
    .max(3),
});

export async function saveContentBlockAction(input: unknown): Promise<ActionResult<null>> {
  const parsed = blockSchema.safeParse(input);
  if (!parsed.success) return fail('validation_failed', 'invalid_request');

  try {
    const admin = await assertPermission('content.write');
    const { productSlug, ...data } = parsed.data;

    await saveContentBlock({
      ...data,
      payload: productSlug ? { productSlug } : {},
    });

    await recordAudit({
      adminId: admin.id,
      action: 'content.update',
      entity: 'content_block',
      entityId: data.id,
      summary: data.translations.find((entry) => entry.locale === 'FR')?.heading ?? null,
    });

    revalidateTag(CONTENT_TAG);
    revalidatePath('/', 'layout');
    revalidatePath(adminRoutes.content);
    return ok(null);
  } catch (error) {
    if (error instanceof AppError) return fail(error.code, error.message);
    console.error('[admin.content.save]', error);
    return fail('unavailable', 'save_failed');
  }
}

/**
 * Settings are free-form strings — a URL field that rejects a half-typed URL
 * while the administrator is still typing is worse than one that accepts it and
 * renders nothing. Anything that must be a URL is validated as one.
 */
const settingsSchema = z.record(
  z.string().max(80),
  z.string().trim().max(5000),
);

const URL_KEYS = new Set(['instagramUrl', 'facebookUrl']);

export async function saveSettingsAction(input: unknown): Promise<ActionResult<null>> {
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return fail('validation_failed', 'invalid_request');

  const fieldErrors: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(parsed.data)) {
    if (URL_KEYS.has(key) && value && !/^https?:\/\/\S+$/.test(value)) {
      (fieldErrors[key] ??= []).push('invalid_url');
    }
  }
  if (Object.keys(fieldErrors).length > 0) {
    return fail('validation_failed', 'invalid_url', fieldErrors);
  }

  try {
    const admin = await assertPermission('settings.write');
    await saveSettings(parsed.data);
    await recordAudit({
      adminId: admin.id,
      action: 'settings.update',
      entity: 'settings',
      entityId: 'site',
      summary: Object.keys(parsed.data).join(', ').slice(0, 255),
    });
    revalidateTag(CONTENT_TAG);
    revalidatePath('/', 'layout');
    return ok(null);
  } catch (error) {
    if (error instanceof AppError) return fail(error.code, error.message);
    console.error('[admin.settings.save]', error);
    return fail('unavailable', 'save_failed');
  }
}
