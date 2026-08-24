'use server';

import { z } from 'zod';
import { revalidatePath, revalidateTag } from 'next/cache';
import {
  adjustStock,
  getProductForEdit,
  saveProduct,
  setProductState,
  softDeleteProduct,
} from '../products';
import { assertPermission } from '../guard';
import { recordAudit } from '@/modules/audit/service';
import { CATALOG_TAG, productTag } from '@/modules/catalog/service';
import { fail, ok, AppError, type ActionResult } from '@/lib/errors';

/**
 * Validation lives here, not in the form.
 *
 * The client form gives immediate feedback, but these schemas are what actually
 * protects the database — an action is an HTTP endpoint and has to assume the
 * request did not come from the form.
 */
const moneySchema = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,3})?$/, 'invalid_price')
  .transform((value) => {
    const [whole = '0', fraction = ''] = value.split('.');
    return `${whole}.${fraction.padEnd(3, '0')}`;
  });

/**
 * An empty form field arrives as "", not as null. Every optional field has to
 * accept it explicitly, or a blank "prix barré" fails the money regex and the
 * whole product refuses to save — which is exactly the kind of validation bug
 * that only shows up once someone tries to use the form.
 *
 * `.optional()` is load-bearing and is **not** the same as putting
 * `z.undefined()` inside the union. Under Zod 4 a *missing key* is rejected as
 * "expected nonoptional" even when the union accepts `undefined`, and React
 * drops undefined properties when it serialises a Server Action payload — so a
 * new variant, which has no `id` yet, arrived with the key absent and the whole
 * create form failed with an error pointing at a field the UI cannot show.
 * Only `.optional()` permits an absent key. See tests/e2e/admin-crud.spec.ts.
 */
const optionalMoney = z
  .union([moneySchema, z.literal(''), z.null()]).optional()
  .transform((value) => (value ? value : null));

const optionalId = z
  .union([z.string().trim().length(24), z.literal(''), z.null()]).optional()
  .transform((value) => (value ? value : null));

const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2)
  .max(160)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'invalid_slug');

const translationSchema = z.object({
  locale: z.enum(['FR', 'EN', 'AR']),
  name: z.string().trim().min(1).max(190),
  tagline: z.string().trim().max(255).nullish().transform((v) => v || null),
  description: z.string().trim().max(20000).nullish().transform((v) => v || null),
  usage: z.string().trim().max(20000).nullish().transform((v) => v || null),
  composition: z.string().trim().max(20000).nullish().transform((v) => v || null),
  precautions: z.string().trim().max(20000).nullish().transform((v) => v || null),
  storage: z.string().trim().max(20000).nullish().transform((v) => v || null),
  metaTitle: z.string().trim().max(190).nullish().transform((v) => v || null),
  metaDescription: z.string().trim().max(320).nullish().transform((v) => v || null),
});

const variantSchema = z.object({
  id: z.union([z.string().trim().length(24), z.literal('')]).optional().transform((v) => v || undefined),
  sku: z.string().trim().min(2).max(60).regex(/^[A-Za-z0-9._-]+$/, 'invalid_sku'),
  format: z.string().trim().min(1).max(60),
  price: moneySchema,
  compareAtPrice: optionalMoney,
  stock: z.coerce.number().int().min(0).max(1_000_000),
  lowStockAt: z.coerce.number().int().min(0).max(10_000),
  allowBackorder: z.coerce.boolean(),
  isActive: z.coerce.boolean(),
  position: z.coerce.number().int().min(0).max(999),
});

const productSchema = z.object({
  id: z.string().trim().length(24).optional(),
  slug: slugSchema,
  reference: z.string().trim().max(60).nullish().transform((v) => v || null),
  categoryId: optionalId,
  state: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']),
  isFeatured: z.coerce.boolean(),
  isProfessional: z.coerce.boolean(),
  position: z.coerce.number().int().min(0).max(9999),
  needIds: z.array(z.string().trim().length(24)).max(20).default([]),
  translations: z.array(translationSchema).min(1).max(3),
  variants: z.array(variantSchema).min(1).max(20),
});

export type ProductActionResult = ActionResult<{ id: string }>;

/**
 * Cache invalidation is explicit and narrow: the changed product's own tag plus
 * the catalogue tag. That keeps the storefront statically served while still
 * making an edit visible within seconds.
 */
function revalidateCatalog(slug?: string) {
  revalidateTag(CATALOG_TAG);
  if (slug) revalidateTag(productTag(slug));
  revalidatePath('/', 'layout');
}

export async function saveProductAction(input: unknown): Promise<ProductActionResult> {
  try {
    const admin = await assertPermission('product.write');
    const parsed = productSchema.safeParse(input);

    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        (fieldErrors[issue.path.join('.') || 'form'] ??= []).push(issue.message);
      }
      return fail('validation_failed', 'invalid_product', fieldErrors);
    }

    const data = parsed.data;
    if (data.state === 'PUBLISHED') await assertPermission('product.publish');

    const before = data.id ? await getProductForEdit(data.id) : null;
    const id = await saveProduct(data);
    const after = await getProductForEdit(id);

    await recordAudit({
      adminId: admin.id,
      action: data.id ? 'product.update' : 'product.create',
      entity: 'product',
      entityId: id,
      summary: data.translations[0]?.name ?? data.slug,
      before: before ? { ...before, media: undefined } : null,
      after: after ? { ...after, media: undefined } : null,
    });

    revalidateCatalog(data.slug);
    if (before?.slug && before.slug !== data.slug) revalidateTag(productTag(before.slug));

    return ok({ id });
  } catch (error) {
    if (error instanceof AppError) return fail(error.code, error.message);
    console.error('[admin.product.save]', error);
    return fail('unavailable', 'save_failed');
  }
}

export async function setProductStateAction(input: unknown): Promise<ActionResult<null>> {
  const parsed = z
    .object({ id: z.string().trim().length(24), state: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']) })
    .safeParse(input);
  if (!parsed.success) return fail('validation_failed', 'invalid_request');

  try {
    const admin = await assertPermission(
      parsed.data.state === 'PUBLISHED' ? 'product.publish' : 'product.write',
    );
    const before = await getProductForEdit(parsed.data.id);
    if (!before) return fail('not_found', 'product_not_found');

    await setProductState(parsed.data.id, parsed.data.state);
    await recordAudit({
      adminId: admin.id,
      action: 'product.state_change',
      entity: 'product',
      entityId: parsed.data.id,
      summary: `${before.state} → ${parsed.data.state}`,
      before: { state: before.state },
      after: { state: parsed.data.state },
    });

    revalidateCatalog(before.slug);
    return ok(null);
  } catch (error) {
    if (error instanceof AppError) return fail(error.code, error.message);
    console.error('[admin.product.state]', error);
    return fail('unavailable', 'update_failed');
  }
}

export async function deleteProductAction(input: unknown): Promise<ActionResult<null>> {
  const parsed = z.object({ id: z.string().trim().length(24) }).safeParse(input);
  if (!parsed.success) return fail('validation_failed', 'invalid_request');

  try {
    const admin = await assertPermission('product.write');
    const before = await getProductForEdit(parsed.data.id);
    if (!before) return fail('not_found', 'product_not_found');

    // Soft delete, always: a hard delete would break historical orders.
    await softDeleteProduct(parsed.data.id);
    await recordAudit({
      adminId: admin.id,
      action: 'product.archive',
      entity: 'product',
      entityId: parsed.data.id,
      summary: before.slug,
    });

    revalidateCatalog(before.slug);
    return ok(null);
  } catch (error) {
    if (error instanceof AppError) return fail(error.code, error.message);
    console.error('[admin.product.delete]', error);
    return fail('unavailable', 'delete_failed');
  }
}

export async function adjustStockAction(input: unknown): Promise<ActionResult<null>> {
  const parsed = z
    .object({
      variantId: z.string().trim().length(24),
      delta: z.coerce.number().int().min(-100000).max(100000).refine((value) => value !== 0),
      note: z.string().trim().max(64).optional(),
    })
    .safeParse(input);
  if (!parsed.success) return fail('validation_failed', 'invalid_request');

  try {
    const admin = await assertPermission('inventory.write');
    await adjustStock(parsed.data.variantId, parsed.data.delta, admin.id, parsed.data.note);
    await recordAudit({
      adminId: admin.id,
      action: 'inventory.adjust',
      entity: 'variant',
      entityId: parsed.data.variantId,
      summary: `${parsed.data.delta > 0 ? '+' : ''}${parsed.data.delta}`,
    });
    revalidateCatalog();
    return ok(null);
  } catch (error) {
    if (error instanceof AppError) return fail(error.code, error.message);
    console.error('[admin.stock.adjust]', error);
    return fail('unavailable', 'update_failed');
  }
}
