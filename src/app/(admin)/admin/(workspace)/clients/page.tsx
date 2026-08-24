import { requirePermission } from '@/modules/admin/guard';
import { listCustomers } from '@/modules/admin/people';
import { AdminPage } from '@/components/admin/AdminPage';
import { AdminFilters } from '@/components/admin/AdminFilters';
import { DataTable } from '@/components/admin/DataTable';
import { Pagination } from '@/components/ui/Pagination';
import { adminRoutes } from '@/lib/routes';
import { formatMoney } from '@/lib/money';
import { formatDate } from '@/lib/datetime';

export const dynamic = 'force-dynamic';

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  await requirePermission('customer.read');
  const query = await searchParams;

  const result = await listCustomers({
    search: query.q,
    page: Number.parseInt(query.page ?? '1', 10) || 1,
  });

  const hrefFor = (page: number) => {
    const params = new URLSearchParams();
    if (query.q) params.set('q', query.q);
    if (page > 1) params.set('page', String(page));
    const qs = params.toString();
    return qs ? `${adminRoutes.customers}?${qs}` : adminRoutes.customers;
  };

  return (
    <AdminPage title="Clients" description={`${result.total} client(s).`} wide>
      <AdminFilters
        basePath={adminRoutes.customers}
        searchValue={query.q ?? ''}
        searchLabel="Rechercher un client"
        searchPlaceholder="Nom, e-mail ou téléphone"
      />

      <div className="mt-6">
        <DataTable
          rows={result.rows}
          emptyMessage="Aucun client ne correspond à cette recherche."
          caption="Clients"
          columns={[
            {
              key: 'name',
              header: 'Client',
              cell: (row) => (
                <span>
                  {row.name || <span className="text-[var(--surface-muted)]">—</span>}
                  <span className="block text-xs text-[var(--surface-muted)]">{row.email}</span>
                </span>
              ),
            },
            {
              key: 'phone',
              header: 'Téléphone',
              cell: (row) =>
                row.phone ? (
                  <a href={`tel:${row.phone}`} className="hover:text-[var(--surface-accent)]">
                    {row.phone}
                  </a>
                ) : (
                  <span className="text-[var(--surface-muted)]">—</span>
                ),
            },
            {
              key: 'account',
              header: 'Compte',
              cell: (row) => (
                <span className="text-xs">
                  {row.hasAccount ? 'Compte créé' : 'Commande sans compte'}
                </span>
              ),
            },
            {
              key: 'orders',
              header: 'Commandes',
              align: 'end',
              cell: (row) => <span className="tabular-nums">{row.orderCount}</span>,
            },
            {
              key: 'value',
              header: 'Total dépensé',
              align: 'end',
              cell: (row) => <span className="tabular-nums">{formatMoney(row.lifetimeValue, 'fr')}</span>,
            },
            {
              key: 'createdAt',
              header: 'Depuis',
              align: 'end',
              secondary: true,
              cell: (row) => (
                <span className="tabular-nums text-[var(--surface-muted)]">{formatDate(row.createdAt)}</span>
              ),
            },
          ]}
        />

        <Pagination
          page={result.page}
          pageCount={result.pageCount}
          hrefFor={hrefFor}
          labels={{ previous: 'Précédent', next: 'Suivant', nav: 'Pagination des clients', page: 'Page' }}
        />
      </div>

      <p className="mt-8 text-xs text-[var(--surface-muted)]">
        Les commandes passées sans compte créent tout de même une fiche client, pour que l’historique
        d’une même adresse e-mail reste réuni.
      </p>
    </AdminPage>
  );
}
