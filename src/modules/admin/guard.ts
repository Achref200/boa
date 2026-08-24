import 'server-only';
import { redirect } from 'next/navigation';
import { getCurrentAdmin, type CurrentAdmin } from '@/modules/identity/session';
import { can, type Permission } from '@/lib/permissions';
import { adminRoutes } from '@/lib/routes';
import { AppError } from '@/lib/errors';

/**
 * Every admin page and every admin mutation goes through here.
 *
 * Knowing the URL /admin is not authorization. The check is server-side, it is
 * per-capability rather than per-role, and it runs again inside each action —
 * a page guard alone would leave the actions callable directly.
 */
export async function requireAdmin(): Promise<CurrentAdmin> {
  const admin = await getCurrentAdmin();
  if (!admin) redirect(adminRoutes.signIn);
  return admin;
}

export async function requirePermission(permission: Permission): Promise<CurrentAdmin> {
  const admin = await requireAdmin();
  if (!can(admin, permission)) redirect(adminRoutes.root);
  return admin;
}

/** For server actions, where a redirect would be the wrong response. */
export async function assertPermission(permission: Permission): Promise<CurrentAdmin> {
  const admin = await getCurrentAdmin();
  if (!admin) throw new AppError('unauthenticated', 'Sign in required');
  if (!can(admin, permission)) throw new AppError('forbidden', `Missing permission: ${permission}`);
  return admin;
}
