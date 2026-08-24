import { config } from 'dotenv';

/**
 * Integration tests run against a real MySQL/MariaDB schema, because the
 * behaviour under test — transactions, unique constraints, conditional updates —
 * does not exist in a mock. TEST_DATABASE_URL points at a throwaway database.
 */
config({ path: '.env.test', quiet: true });
config({ path: '.env.local', quiet: true });

if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}
process.env.APP_SECRET ??= 'test-secret-value-that-is-long-enough-1234567890';
process.env.NEXT_PUBLIC_SITE_URL ??= 'http://localhost:3000';
