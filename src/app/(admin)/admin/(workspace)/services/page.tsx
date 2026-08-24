import { requirePermission } from '@/modules/admin/guard';
import { listServices } from '@/modules/admin/services';
import { AdminPage } from '@/components/admin/AdminPage';
import { DataTable } from '@/components/admin/DataTable';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ButtonLink } from '@/components/ui/Button';
import { adminRoutes } from '@/lib/routes';
import { formatMoney } from '@/lib/money';
import { PUBLISH_STATE_FR } from '@/lib/labels';

export const dynamic = 'force-dynamic';

export default async function AdminServicesPage() {
  await requirePermission('service.write');
  const services = await listServices();

  return (
    <AdminPage
      title="Services"
      description="Ce que BOA propose à la réservation, et les horaires qui génèrent les créneaux."
      actions={<ButtonLink href={`${adminRoutes.services}/nouveau`}>Nouveau service</ButtonLink>}
      wide
    >
      <DataTable
        rows={services}
        hrefFor={(row) => adminRoutes.service(row.id)}
        emptyMessage="Aucun service. Les clientes ne verront pas de section « réservation » tant qu’il n’y en a pas."
        caption="Services"
        columns={[
          { key: 'name', header: 'Service', cell: (row) => row.name },
          {
            key: 'duration',
            header: 'Durée',
            cell: (row) => <span className="tabular-nums">{row.durationMin} min</span>,
          },
          {
            key: 'capacity',
            header: 'Places',
            align: 'end',
            cell: (row) => <span className="tabular-nums">{row.capacity}</span>,
          },
          {
            key: 'price',
            header: 'Prix',
            align: 'end',
            cell: (row) =>
              row.price ? (
                <span className="tabular-nums">{formatMoney(row.price, 'fr')}</span>
              ) : (
                <span className="text-[var(--surface-muted)]">—</span>
              ),
          },
          {
            key: 'location',
            header: 'Lieu',
            secondary: true,
            cell: (row) => row.locationName ?? <span className="text-[var(--surface-muted)]">—</span>,
          },
          {
            key: 'upcoming',
            header: 'À venir',
            align: 'end',
            cell: (row) => <span className="tabular-nums">{row.upcomingReservations}</span>,
          },
          {
            key: 'state',
            header: 'État',
            cell: (row) => (
              <StatusBadge
                tone={row.state === 'PUBLISHED' ? 'positive' : row.state === 'DRAFT' ? 'caution' : 'neutral'}
              >
                {PUBLISH_STATE_FR[row.state] ?? row.state}
              </StatusBadge>
            ),
          },
        ]}
      />
    </AdminPage>
  );
}
