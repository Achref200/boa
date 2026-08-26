/**
 * Where the administrator session captured by `auth.setup.ts` is stored.
 *
 * A plain module rather than an export from the setup spec, because Playwright
 * refuses to let one test file import another.
 */
export const ADMIN_STATE = 'tests/.auth/admin.json';
