'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { deleteAddress, saveAddress, updateProfile } from './account';
import { getCurrentCustomer } from './session';
import { fail, ok, AppError, type ActionResult } from '@/lib/errors';

const phoneSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/[\s.-]/g, ''))
  .refine((value) => value === '' || /^(\+216)?[2-59]\d{7}$/.test(value), { message: 'invalid_phone' });

const addressSchema = z.object({
  id: z.union([z.string().trim().length(24), z.literal('')]).optional().transform((v) => v || undefined),
  label: z.string().trim().max(60).optional().or(z.literal('')),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  phone: phoneSchema.refine((value) => value !== '', { message: 'required' }),
  line1: z.string().trim().min(1).max(190),
  line2: z.string().trim().max(190).optional().or(z.literal('')),
  city: z.string().trim().min(1).max(90),
  governorate: z.string().trim().min(1).max(90),
  postalCode: z.string().trim().max(20).optional().or(z.literal('')),
  isDefault: z.coerce.boolean(),
});

/** Every account action re-reads the session; the customer id is never a parameter. */
export async function saveAddressAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const customer = await getCurrentCustomer();
  if (!customer) return fail('unauthenticated', 'sign_in_required');

  const parsed = addressSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      (fieldErrors[issue.path.join('.') || 'form'] ??= []).push(issue.message);
    }
    return fail('validation_failed', 'invalid_address', fieldErrors);
  }

  try {
    const id = await saveAddress(customer.id, {
      id: parsed.data.id,
      label: parsed.data.label || null,
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      phone: parsed.data.phone,
      line1: parsed.data.line1,
      line2: parsed.data.line2 || null,
      city: parsed.data.city,
      governorate: parsed.data.governorate,
      postalCode: parsed.data.postalCode || null,
      isDefault: parsed.data.isDefault,
    });
    revalidatePath('/', 'layout');
    return ok({ id });
  } catch (error) {
    if (error instanceof AppError) return fail(error.code, error.message);
    console.error('[account.address.save]', error);
    return fail('unavailable', 'save_failed');
  }
}

export async function deleteAddressAction(input: unknown): Promise<ActionResult<null>> {
  const customer = await getCurrentCustomer();
  if (!customer) return fail('unauthenticated', 'sign_in_required');

  const parsed = z.object({ id: z.string().trim().length(24) }).safeParse(input);
  if (!parsed.success) return fail('validation_failed', 'invalid_request');

  await deleteAddress(customer.id, parsed.data.id);
  revalidatePath('/', 'layout');
  return ok(null);
}

export async function updateProfileAction(input: unknown): Promise<ActionResult<null>> {
  const customer = await getCurrentCustomer();
  if (!customer) return fail('unauthenticated', 'sign_in_required');

  const parsed = z
    .object({
      firstName: z.string().trim().min(1).max(80),
      lastName: z.string().trim().min(1).max(80),
      phone: phoneSchema,
    })
    .safeParse(input);
  if (!parsed.success) return fail('validation_failed', 'invalid_profile');

  await updateProfile(customer.id, {
    firstName: parsed.data.firstName,
    lastName: parsed.data.lastName,
    phone: parsed.data.phone || null,
  });
  revalidatePath('/', 'layout');
  return ok(null);
}
