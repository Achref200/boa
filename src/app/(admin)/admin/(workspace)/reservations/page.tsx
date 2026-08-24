import { requirePermission } from '@/modules/admin/guard';
import { listReservations, RESERVATION_TRANSITIONS, type ReservationStatus } from '@/modules/admin/reservations';
import { can } from '@/lib/permissions';
import { AdminPage } from '@/components/admin/AdminPage';
import { AdminFilters } from '@/components/admin/AdminFilters';
import { DataTable } from '@/components/admin/DataTable';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Pagination } from '@/components/ui/Pagination';
import { ReservationActions } from '@/components/admin/ReservationActions';
import { adminRoutes } from '@/lib/routes';
import { formatDateTime } from '@/lib/datetime';
import { RESERVATION_STATUS_FR } from '@/lib/labels';

export const dynamic = 'force-dynamic';

const STATUSES: ReservationStatus[] = ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'];

export default async function AdminReservationsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; statut?: string; page?: string; passees?: string }>;
}) {
  const admin = await requirePermission('reservation.read');
  const query = await searchParams;
  const status = STATUSES.includes(query.statut as ReservationStatus)
    ? (query.statut as ReservationStatus)
    : undefined;

  // Upcoming by default: a booking list that opens on last year's appointments
  // is a list nobody reads.
  const showPast = query.passees === '1';

  const result = await listReservations({
    search: query.q,
    status,
    from: showPast ? undefined : new Date(Date.now() - 12 * 60 * 60 * 1000),
    page: Number.parseInt(query.page ?? '1', 10) || 1,
  });

  const canWrite = can(admin, 'reservation.write');

  const hrefFor = (page: number) => {
    const params = new URLSearchParams();
    if (query.q) params.set('q', query.q);
    if (status) params.set('statut', status);
    if (showPast) params.set('passees', '1');
    if (page > 1) params.set('page', String(page));
    const qs = params.toString();
    return qs ? `${adminRoutes.reservations}?${qs}` : adminRoutes.reservations;
  };

  return (
    <AdminPage
      title="Réservations"
      description={showPast ? `${result.total} réservation(s), historique inclus.` : `${result.total} réservation(s) à venir.`}
      wide
    >
      <AdminFilters
        basePath={adminRoutes.reservations}
        searchValue={query.q ?? ''}
        searchLabel="Rechercher une réservation"
        searchPlaceholder="Référence, nom, e-mail ou téléphone"
        selects={[
          {
            name: 'statut',
            label: 'Statut',
            value: status ?? '',
            options: [
              { value: '', label: 'Tous' },
              ...STATUSES.map((value) => ({ value, label: RESERVATION_STATUS_FR[value] ?? value })),
            ],
          },
          {
            name: 'passees',
            label: 'Période',
            value: showPast ? '1' : '',
            options: [
              { value: '', label: 'À venir' },
              { value: '1', label: 'Tout l’historique' },
            ],
          },
        ]}
      />

      <div className="mt-6">
        <DataTable
          rows={result.rows}
          emptyMessage="Aucune réservation ne correspond à cette recherche."
          caption="Réservations"
          columns={[
            {
              key: 'startsAt',
              header: 'Quand',
              cell: (row) => <span className="tabular-nums">{formatDateTime(row.startsAt)}</span>,
            },
            { key: 'service', header: 'Service', cell: (row) => row.serviceName },
            {
              key: 'customer',
              header: 'Client',
              cell: (row) => (
                <span>
                  {row.customerName}
                  <span className="block text-xs text-[var(--surface-muted)]">
                    <a href={`tel:${row.phone}`} className="hover:text-[var(--surface-fg)]">{row.phone}</a>
                  </span>
                </span>
              ),
            },
            {
              key: 'reference',
              header: 'Référence',
              secondary: true,
              cell: (row) => <span className="tabular-nums text-[var(--surface-muted)]">{row.reference}</span>,
            },
            {
              key: 'status',
              header: 'Statut',
              cell: (row) => (
                <StatusBadge
                  tone={
                    row.status === 'CONFIRMED' || row.status === 'COMPLETED'
                      ? 'positive'
                      : row.status === 'PENDING'
                        ? 'caution'
                        : 'critical'
                  }
                >
                  {RESERVATION_STATUS_FR[row.status] ?? row.status}
                </StatusBadge>
              ),
            },
            {
              key: 'actions',
              header: 'Action',
              align: 'end',
              cell: (row) =>
                canWrite ? (
                  <ReservationActions
                    reservationId={row.id}
                    allowed={RESERVATION_TRANSITIONS[row.status as ReservationStatus] ?? []}
                  />
                ) : null,
            },
          ]}
        />

        <Pagination
          page={result.page}
          pageCount={result.pageCount}
          hrefFor={hrefFor}
          labels={{ previous: 'Précédent', next: 'Suivant', nav: 'Pagination des réservations', page: 'Page' }}
        />
      </div>
    </AdminPage>
  );
}
