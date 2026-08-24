import { requireAdmin } from '@/modules/admin/guard';
import { AdminShell, type NavGroup } from '@/components/admin/AdminShell';
import { AdminSignOutButton } from '@/components/admin/AdminSignOutButton';
import { adminRoutes } from '@/lib/routes';
import { can } from '@/lib/permissions';
import { db } from '@/db/client';

/**
 * Guard first, chrome second. Every page under this layout is authenticated,
 * and the navigation only lists what the signed-in role can actually reach —
 * showing a link that leads to a redirect is a small lie that costs trust.
 */
export const dynamic = 'force-dynamic';

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super administrateur',
  catalog_manager: 'Responsable catalogue',
  order_manager: 'Responsable commandes',
  reservation_manager: 'Responsable réservations',
};

export default async function AdminWorkspaceLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();

  // Two counts, both cheap and both genuinely actionable in the rail.
  const [pendingOrders, pendingReservations] = await Promise.all([
    can(admin, 'order.read')
      ? db
          .selectFrom('orders')
          .select((eb) => eb.fn.countAll<number>().as('count'))
          .where('status', 'in', ['PENDING', 'CONFIRMED', 'PREPARING'])
          .executeTakeFirst()
      : Promise.resolve(undefined),
    can(admin, 'reservation.read')
      ? db
          .selectFrom('reservations')
          .select((eb) => eb.fn.countAll<number>().as('count'))
          .where('status', '=', 'PENDING')
          .where('starts_at', '>=', new Date())
          .executeTakeFirst()
      : Promise.resolve(undefined),
  ]);

  const groups: NavGroup[] = [
    {
      title: 'Aujourd’hui',
      items: [{ href: adminRoutes.root, label: 'Tableau de bord' }],
    },
    {
      title: 'Vendre',
      items: [
        ...(can(admin, 'order.read')
          ? [{ href: adminRoutes.orders, label: 'Commandes', badge: Number(pendingOrders?.count ?? 0) }]
          : []),
        ...(can(admin, 'customer.read') ? [{ href: adminRoutes.customers, label: 'Clients' }] : []),
        ...(can(admin, 'discount.write') ? [{ href: adminRoutes.discounts, label: 'Remises' }] : []),
        ...(can(admin, 'shipping.write') ? [{ href: adminRoutes.shipping, label: 'Livraison' }] : []),
      ],
    },
    {
      title: 'Catalogue',
      items: [
        ...(can(admin, 'product.read') ? [{ href: adminRoutes.products, label: 'Produits' }] : []),
        ...(can(admin, 'catalog.write')
          ? [
              { href: adminRoutes.categories, label: 'Catégories' },
              { href: adminRoutes.collections, label: 'Collections' },
              { href: adminRoutes.rituals, label: 'Rituels' },
              { href: adminRoutes.needs, label: 'Besoins' },
            ]
          : []),
      ],
    },
    {
      title: 'Réserver',
      items: [
        ...(can(admin, 'reservation.read')
          ? [
              {
                href: adminRoutes.reservations,
                label: 'Réservations',
                badge: Number(pendingReservations?.count ?? 0),
              },
            ]
          : []),
        ...(can(admin, 'service.write') ? [{ href: adminRoutes.services, label: 'Services' }] : []),
      ],
    },
    {
      title: 'Publier',
      items: [
        ...(can(admin, 'content.write')
          ? [
              { href: adminRoutes.content, label: 'Contenu' },
              { href: adminRoutes.inquiries, label: 'Messages' },
            ]
          : []),
      ],
    },
    {
      title: 'Configurer',
      items: [
        ...(can(admin, 'settings.write') ? [{ href: adminRoutes.settings, label: 'Réglages' }] : []),
        ...(can(admin, 'audit.read') ? [{ href: adminRoutes.audit, label: 'Journal' }] : []),
      ],
    },
  ].filter((group) => group.items.length > 0);

  return (
    <AdminShell
      groups={groups}
      adminName={admin.name}
      roleLabel={ROLE_LABELS[admin.roleKey] ?? admin.roleKey}
      signOut={<AdminSignOutButton />}
    >
      {children}
    </AdminShell>
  );
}
