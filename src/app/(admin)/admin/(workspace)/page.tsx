import Link from 'next/link';
import { requireAdmin } from '@/modules/admin/guard';
import { getDashboardData } from '@/modules/admin/dashboard';
import { purgeExpiredSessions } from '@/modules/identity/session';
import { AdminPage, EmptyState, Panel } from '@/components/admin/AdminPage';
import { StatTile } from '@/components/admin/StatTile';
import { DataTable } from '@/components/admin/DataTable';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { formatMoney } from '@/lib/money';
import { adminRoutes } from '@/lib/routes';
import { formatDateTime } from '@/lib/datetime';

export const dynamic = 'force-dynamic';

const ORDER_STATUS_FR: Record<string, string> = {
  PENDING: 'En attente',
  CONFIRMED: 'Confirmée',
  PREPARING: 'En préparation',
  SHIPPED: 'Expédiée',
  READY_FOR_PICKUP: 'Prête au retrait',
  COMPLETED: 'Terminée',
  CANCELLED: 'Annulée',
  REFUNDED: 'Remboursée',
};

const RESERVATION_STATUS_FR: Record<string, string> = {
  PENDING: 'En attente',
  CONFIRMED: 'Confirmée',
  COMPLETED: 'Honorée',
  CANCELLED: 'Annulée',
  NO_SHOW: 'Non honorée',
};

export default async function AdminDashboardPage() {
  const admin = await requireAdmin();

  // Cheap housekeeping on a page an admin opens daily, instead of a cron job
  // that Hostinger's shared plans make awkward to schedule.
  await purgeExpiredSessions().catch(() => undefined);

  const data = await getDashboardData();



  return (
    <AdminPage
      title={`Bonjour ${admin.name.split(' ')[0]}`}
      description="Ce qui demande votre attention aujourd’hui."
      wide
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Commandes à traiter"
          value={data.ordersToHandle}
          href={adminRoutes.orders}
          tone="attention"
        />
        <StatTile
          label="Réservations aujourd’hui"
          value={data.reservationsToday}
          href={adminRoutes.reservations}
        />
        <StatTile
          label="Stock faible"
          value={data.lowStockCount}
          href={adminRoutes.products}
          tone="attention"
        />
        <StatTile
          label="Chiffre d’affaires (30 j)"
          value={formatMoney(data.revenue30d, 'fr')}
          hint={`${data.orders30d} commande(s) · ${data.newCustomers30d} nouveau(x) client(s)`}
        />
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <Panel
          title="Dernières commandes"
          actions={
            <Link href={adminRoutes.orders} className="text-xs underline underline-offset-4">
              Tout voir
            </Link>
          }
        >
          <DataTable
            rows={data.recentOrders}
            hrefFor={(row) => adminRoutes.order(row.id)}
            emptyMessage="Aucune commande pour le moment."
            caption="Dernières commandes"
            columns={[
              { key: 'reference', header: 'Référence', cell: (row) => <span className="tabular-nums">{row.reference}</span> },
              { key: 'customer', header: 'Client', cell: (row) => row.customerName },
              {
                key: 'status',
                header: 'Statut',
                cell: (row) => (
                  <StatusBadge tone={row.status === 'PENDING' ? 'caution' : 'neutral'}>
                    {ORDER_STATUS_FR[row.status] ?? row.status}
                  </StatusBadge>
                ),
              },
              {
                key: 'total',
                header: 'Total',
                align: 'end',
                cell: (row) => <span className="tabular-nums">{formatMoney(row.grandTotal, 'fr')}</span>,
              },
              {
                key: 'placedAt',
                header: 'Date',
                secondary: true,
                cell: (row) => <span className="text-[var(--surface-muted)]">{formatDateTime(row.placedAt)}</span>,
              },
            ]}
          />
        </Panel>

        <Panel
          title="Prochaines réservations"
          actions={
            <Link href={adminRoutes.reservations} className="text-xs underline underline-offset-4">
              Tout voir
            </Link>
          }
        >
          <DataTable
            rows={data.upcomingReservations}
            emptyMessage="Aucune réservation à venir."
            caption="Prochaines réservations"
            columns={[
              { key: 'startsAt', header: 'Quand', cell: (row) => <span className="tabular-nums">{formatDateTime(row.startsAt)}</span> },
              { key: 'service', header: 'Service', cell: (row) => row.serviceName },
              { key: 'customer', header: 'Client', cell: (row) => row.customerName },
              {
                key: 'status',
                header: 'Statut',
                cell: (row) => (
                  <StatusBadge tone={row.status === 'PENDING' ? 'caution' : 'positive'}>
                    {RESERVATION_STATUS_FR[row.status] ?? row.status}
                  </StatusBadge>
                ),
              },
            ]}
          />
        </Panel>

        <Panel title="Stock faible">
          {data.lowStock.length === 0 ? (
            <EmptyState message="Aucun produit sous son seuil d’alerte." />
          ) : (
            <DataTable
              rows={data.lowStock}
              emptyMessage=""
              caption="Produits dont le stock est bas"
              columns={[
                { key: 'product', header: 'Produit', cell: (row) => row.productName },
                { key: 'format', header: 'Format', cell: (row) => row.format },
                { key: 'sku', header: 'SKU', secondary: true, cell: (row) => <span className="tabular-nums text-[var(--surface-muted)]">{row.sku}</span> },
                {
                  key: 'stock',
                  header: 'Stock',
                  align: 'end',
                  cell: (row) => (
                    <span className={row.stock === 0 ? 'text-[var(--color-critical)]' : 'text-[var(--color-caution)]'}>
                      {row.stock} / {row.lowStockAt}
                    </span>
                  ),
                },
              ]}
            />
          )}
        </Panel>

        {/* The honest counterpart to a "setup complete" checklist: what BOA
            still has to supply before this site can go live. */}
        {data.contentToComplete.length > 0 ? (
          <Panel title="Contenu à compléter">
            <ul className="flex flex-col gap-2 text-sm">
              {data.contentToComplete.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[var(--color-caution)]" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-[var(--surface-muted)]">
              Ces éléments sont des valeurs de démonstration : rien n’a été inventé pour BOA.
            </p>
          </Panel>
        ) : null}
      </div>
    </AdminPage>
  );
}
