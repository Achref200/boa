'use server';

import { z } from 'zod';
import { db } from '@/db/client';
import { newId } from '@/lib/ids';
import { fail, ok, type ActionResult } from '@/lib/errors';
import { rateLimit, LIMITS } from '@/lib/rate-limit';
import { clientIp } from '@/lib/request';

/**
 * Contact and professional enquiries.
 *
 * Stored rather than emailed: BOA's mail configuration is not known yet, and a
 * message that fails to send silently is worse than one sitting in an inbox the
 * team can actually see. When SMTP is configured the same action gains a
 * notification without changing what the customer experiences.
 *
 * The honeypot field is not a CAPTCHA — it costs a legitimate visitor nothing
 * and stops the majority of naive form spam. Anything more aggressive would
 * make it harder for a real customer to reach a small business.
 */
const inquirySchema = z.object({
  kind: z.enum(['CONTACT', 'PROFESSIONAL']).default('CONTACT'),
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().email().max(190),
  phone: z.string().trim().max(40).optional().or(z.literal('')),
  company: z.string().trim().max(160).optional().or(z.literal('')),
  subject: z.string().trim().max(190).optional().or(z.literal('')),
  message: z.string().trim().min(10).max(4000),
  // Hidden field. A browser never fills it; a bot usually does.
  website: z.string().max(0).optional().or(z.literal('')),
});

export async function submitInquiryAction(input: unknown): Promise<ActionResult<null>> {
  const ip = await clientIp();
  if (!rateLimit(`inquiry:${ip}`, LIMITS.contact.limit, LIMITS.contact.window).allowed) {
    return fail('rate_limited', 'too_many');
  }

  const parsed = inquirySchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      (fieldErrors[issue.path.join('.') || 'form'] ??= []).push(issue.message);
    }
    return fail('validation_failed', 'invalid_form', fieldErrors);
  }

  // A filled honeypot is answered with success. Telling a bot it failed only
  // teaches it to try again.
  if (parsed.data.website) return ok(null);

  await db
    .insertInto('inquiries')
    .values({
      id: newId(),
      kind: parsed.data.kind,
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone || null,
      company: parsed.data.company || null,
      subject: parsed.data.subject || null,
      message: parsed.data.message,
    })
    .execute();

  return ok(null);
}
