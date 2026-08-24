import 'server-only';
import { z } from 'zod';

/**
 * Environment is parsed once, at import time, and the process refuses to start
 * on a bad value. A missing DATABASE_URL should fail the deploy, not the first
 * customer's checkout.
 */
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  NEXT_PUBLIC_SITE_URL: z.string().url().default('http://localhost:3000'),
  APP_SECRET: z.string().min(32, 'APP_SECRET must be at least 32 characters'),
  MEDIA_DRIVER: z.enum(['local', 's3']).default('local'),
  NEXT_PUBLIC_MEDIA_BASE_URL: z.string().optional(),
  MEDIA_MAX_BYTES: z.coerce.number().int().positive().default(5 * 1024 * 1024),
  PAYMENT_PROVIDERS: z.string().default('cod,cop,bank_transfer'),
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_PUBLIC_BASE_URL: z.string().optional(),
  SMTP_URL: z.string().optional(),
  MAIL_FROM: z.string().optional(),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  • ${i.path.join('.')}: ${i.message}`).join('\n');
  throw new Error(`Invalid environment configuration:\n${issues}`);
}

export const env = parsed.data;

export const isProduction = env.NODE_ENV === 'production';
export const enabledPaymentProviders = env.PAYMENT_PROVIDERS.split(',')
  .map((p) => p.trim())
  .filter(Boolean);
