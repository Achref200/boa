'use server';

import { z } from 'zod';
import { revalidateTag } from 'next/cache';
import { db } from '@/db/client';
import { newId } from '@/lib/ids';
import { storage, readImageSize } from '@/modules/media/storage';
import { assertPermission } from '../guard';
import { recordAudit } from '@/modules/audit/service';
import { CATALOG_TAG, productTag } from '@/modules/catalog/service';
import { fail, ok, AppError, type ActionResult } from '@/lib/errors';

const MEDIA_ERRORS: Record<string, string> = {
  unsupported_media_type: 'Format non pris en charge (JPEG, PNG, WebP ou AVIF).',
  file_too_large: 'Fichier trop volumineux.',
};

async function slugOf(productId: string): Promise<string | undefined> {
  const row = await db.selectFrom('products').select('slug').where('id', '=', productId).executeTakeFirst();
  return row?.slug;
}

/**
 * Upload goes through a Server Action rather than a REST endpoint so it inherits
 * the same origin check, the same permission guard and the same audit trail as
 * every other admin mutation. The file itself never touches a path the uploader
 * controls — see `modules/media/storage`.
 */
export async function uploadProductMediaAction(formData: FormData): Promise<ActionResult<{ id: string }>> {
  try {
    const admin = await assertPermission('product.write');

    const productId = z.string().trim().length(24).parse(formData.get('productId'));
    const file = formData.get('file');
    if (!(file instanceof File) || file.size === 0) {
      return fail('validation_failed', 'no_file');
    }

    const stored = await storage.put(file, 'produits');
    const size = readImageSize(Buffer.from(await file.arrayBuffer()));

    const last = await db
      .selectFrom('product_media')
      .select((eb) => eb.fn.max('position').as('max'))
      .where('product_id', '=', productId)
      .executeTakeFirst();

    const id = newId();
    await db
      .insertInto('product_media')
      .values({
        id,
        product_id: productId,
        kind: 'IMAGE',
        path: stored.path,
        alt: null,
        width: size?.width ?? null,
        height: size?.height ?? null,
        position: Number(last?.max ?? -1) + 1,
      })
      .execute();

    await recordAudit({
      adminId: admin.id,
      action: 'media.upload',
      entity: 'product',
      entityId: productId,
      summary: stored.path,
    });

    revalidateTag(CATALOG_TAG);
    const slug = await slugOf(productId);
    if (slug) revalidateTag(productTag(slug));

    return ok({ id });
  } catch (error) {
    if (error instanceof AppError) return fail(error.code, MEDIA_ERRORS[error.message] ?? error.message);
    console.error('[admin.media.upload]', error);
    return fail('unavailable', 'upload_failed');
  }
}

export async function deleteProductMediaAction(input: unknown): Promise<ActionResult<null>> {
  const parsed = z.object({ id: z.string().trim().length(24) }).safeParse(input);
  if (!parsed.success) return fail('validation_failed', 'invalid_request');

  try {
    const admin = await assertPermission('product.write');
    const media = await db
      .selectFrom('product_media')
      .select(['id', 'path', 'product_id as productId'])
      .where('id', '=', parsed.data.id)
      .executeTakeFirst();
    if (!media) return fail('not_found', 'media_not_found');

    await db.deleteFrom('product_media').where('id', '=', media.id).execute();
    // The row goes first: an orphaned file is harmless, a database row pointing
    // at a deleted file renders a broken image on the storefront.
    await storage.remove(media.path).catch(() => undefined);

    await recordAudit({
      adminId: admin.id,
      action: 'media.delete',
      entity: 'product',
      entityId: media.productId,
      summary: media.path,
    });

    revalidateTag(CATALOG_TAG);
    const slug = await slugOf(media.productId);
    if (slug) revalidateTag(productTag(slug));

    return ok(null);
  } catch (error) {
    if (error instanceof AppError) return fail(error.code, error.message);
    console.error('[admin.media.delete]', error);
    return fail('unavailable', 'delete_failed');
  }
}

export async function updateProductMediaAction(input: unknown): Promise<ActionResult<null>> {
  const parsed = z
    .object({
      items: z
        .array(
          z.object({
            id: z.string().trim().length(24),
            alt: z.string().trim().max(255).nullish().transform((v) => v || null),
            position: z.coerce.number().int().min(0).max(99),
          }),
        )
        .max(30),
    })
    .safeParse(input);
  if (!parsed.success) return fail('validation_failed', 'invalid_request');

  try {
    const admin = await assertPermission('product.write');
    let productId: string | null = null;

    for (const item of parsed.data.items) {
      const row = await db
        .selectFrom('product_media')
        .select('product_id as productId')
        .where('id', '=', item.id)
        .executeTakeFirst();
      if (!row) continue;
      productId = row.productId;
      await db
        .updateTable('product_media')
        .set({ alt: item.alt, position: item.position })
        .where('id', '=', item.id)
        .execute();
    }

    if (productId) {
      await recordAudit({
        adminId: admin.id,
        action: 'media.update',
        entity: 'product',
        entityId: productId,
        summary: `${parsed.data.items.length} visuel(s)`,
      });
      revalidateTag(CATALOG_TAG);
      const slug = await slugOf(productId);
      if (slug) revalidateTag(productTag(slug));
    }

    return ok(null);
  } catch (error) {
    if (error instanceof AppError) return fail(error.code, error.message);
    console.error('[admin.media.update]', error);
    return fail('unavailable', 'update_failed');
  }
}
