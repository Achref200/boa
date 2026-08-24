import { requirePermission } from '@/modules/admin/guard';
import { listOrders, type OrderStatus } from '@/modules/admin/orders';
import { AdminPage } from '@/components/admin/AdminPage';
import { AdminFilters } from '@/components/admin/AdminFilters';
import { DataTable } from '@/components/admin/DataTable';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Pagination } from '@/components/ui/Pagination';
import { adminRoutes } from '@/lib/routes';
import { formatMoney } from '@/lib/money';
import { formatDateTime } from '@/lib/datetime';
import { FULFILMENT_FR, ORDER_STATUS_FR, PAYMENT_STATUS_FR, orderStatusTone } from '@/lib/labels';

export const dynamic = 'force-dynamic';

const STATUSES: OrderStatus[] = [
  'PENDING', 'CONFIRMED', 'PREPARING', 'SHIPPED',
  'READY_FOR_PICKUP', 'COMPLETED', 'CANCELLED', 'REFUNDED',
];

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; statut?: string; page?: string }>;
}) {
  await requirePermission('order.read');
  const query = await searchParams;
  const status = STATUSES.includes(query.statut as OrderStatus) ? (query.statut as OrderStatus) : undefined;

  const result = await listOrders({
    search: query.q,
    status,
    page: Number.parseInt(query.page ?? '1', 10) || 1,
  });

  const hrefFor = (page: number) => {
    const params = new URLSearchParams();
    if (query.q) params.set('q', query.q);
    if (status) params.set('statut', status);
    if (page > 1) params.set('page', String(page));
    const qs = params.toString();
    return qs ? `${adminRoutes.orders}?${qs}` : adminRoutes.orders;
  };

  return (
    <AdminPage title="Commandes" description={`${result.total} commande(s).`} wide>
      <AdminFilters
        basePath={adminRoutes.orders}
        searchValue={query.q ?? ''}
        searchLabel="Rechercher une commande"
        searchPlaceholder="Référence, nom, e-mail ou téléphone"
        selects={[
          {
            name: 'statut',
            label: 'Statut',
            value: status ?? '',
            options: [
              { value: '', label: 'Tous' },
              ...STATUSES.map((value) => ({ value, label: ORDER_STATUS_FR[value] ?? value })),
            ],
          },
        ]}
      />

      <div className="mt-6">
        <DataTable
          rows={result.rows}
          hrefFor={(row) => adminRoutes.order(row.id)}
          emptyMessage="Aucune commande ne correspond à cette recherche."
          caption="Commandes"
          columns={[
            { key: 'reference', header: 'Référence', cell: (row) => <span className="tabular-nums">{row.reference}</span> },
            { key: 'customer', header: 'Client', cell: (row) => (
              <span>
                {row.customerName}
                <span className="block text-xs text-[var(--surface-muted)]">{row.email}</span>
              </span>
            ) },
            {
              key: 'status',
              header: 'Statut',
              cell: (row) => (
                <StatusBadge tone={orderStatusTone(row.status)}>
                  {ORDER_STATUS_FR[row.status] ?? row.status}
                </StatusBadge>
              ),
            },
            {
              key: 'payment',
              header: 'Paiement',
              cell: (row) => (
                <StatusBadge tone={row.paymentStatus === 'PAID' ? 'positive' : 'neutral'}>
                  {PAYMENT_STATUS_FR[row.paymentStatus] ?? row.paymentStatus}
                </StatusBadge>
              ),
            },
            {
              key: 'fulfilment',
              header: 'Réception',
              secondary: true,
              cell: (row) => <span className="text-xs">{FULFILMENT_FR[row.fulfilment] ?? row.fulfilment}</span>,
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
              align: 'end',
              cell: (row) => <span className="tabular-nums text-[var(--surface-muted)]">{formatDateTime(row.placedAt)}</span>,
            },
          ]}
        />

        <Pagination
          page={result.page}
          pageCount={result.pageCount}
          hrefFor={hrefFor}
          labels={{ previous: 'Précédent', next: 'Suivant', nav: 'Pagination des commandes', page: 'Page' }}
        />
      </div>
    </AdminPage>
  );
}
