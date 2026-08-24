import { redirect } from 'next/navigation';
import { getCurrentAdmin } from '@/modules/identity/session';
import { AdminSignInForm } from '@/components/admin/AdminSignInForm';
import { Logo } from '@/components/brand/Logo';
import { adminRoutes } from '@/lib/routes';

export const dynamic = 'force-dynamic';

export default async function AdminSignInPage() {
  if (await getCurrentAdmin()) redirect(adminRoutes.root);

  return (
    <main data-surface="ink" className="grid min-h-dvh place-items-center bg-[var(--surface-bg)] px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-5 text-center">
          <Logo size={72} priority className="h-18 w-18" />
          <p className="lockup text-[var(--surface-accent)]">Administration</p>
        </div>

        <div className="mt-10">
          <AdminSignInForm redirectTo={adminRoutes.root} />
        </div>

        <p className="mt-10 text-center text-xs text-[var(--surface-muted)]">
          Accès réservé à l&apos;équipe BOA.
        </p>
      </div>
    </main>
  );
}
