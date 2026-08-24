import Link from 'next/link';
import { requirePermission } from '@/modules/admin/guard';
import { listProducts } from '@/modules/admin/products';
import { AdminPage } from '@/components/admin/AdminPage';
import { DataTable } from '@/components/admin/DataTable';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Pagination } from '@/components/ui/Pagination';
import { ButtonLink } from '@/components/ui/Button';
import { AdminFilters } from '@/components/admin/AdminFilters';
import { adminRoutes } from '@/lib/routes';
import { formatMoney } from '@/lib/money';

export const dynamic = 'force-dynamic';

const STATE_LABEL: Record<string, string> = {
  DRAFT: 'Brouillon',
  PUBLISHED: 'Publié',
  ARCHIVED: 'Archivé',
};

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; etat?: string; page?: string }>;
}) {
  await requirePermission('product.read');
  const query = await searchParams;

  const state =
    query.etat === 'DRAFT' || query.etat === 'PUBLISHED' || query.etat === 'ARCHIVED'
      ? query.etat
      : undefined;

  const result = await listProducts({
    search: query.q,
    state,
    page: Number.parseInt(query.page ?? '1', 10) || 1,
  });

  const hrefFor = (page: number) => {
    const params = new URLSearchParams();
    if (query.q) params.set('q', query.q);
    if (state) params.set('etat', state);
    if (page > 1) params.set('page', String(page));
    const qs = params.toString();
    return qs ? `${adminRoutes.products}?${qs}` : adminRoutes.products;
  };

  return (
    <AdminPage
      title="Produits"
      description={`${result.total} produit(s) au catalogue.`}
      wide
      actions={<ButtonLink href={adminRoutes.newProduct}>Nouveau produit</ButtonLink>}
    >
      <AdminFilters
        basePath={adminRoutes.products}
        searchValue={query.q ?? ''}
        searchLabel="Rechercher un produit"
        searchPlaceholder="Nom, slug ou référence"
        selects={[
          {
            name: 'etat',
            label: 'État',
            value: state ?? '',
            options: [
              { value: '', label: 'Tous' },
              { value: 'PUBLISHED', label: 'Publié' },
              { value: 'DRAFT', label: 'Brouillon' },
              { value: 'ARCHIVED', label: 'Archivé' },
            ],
          },
        ]}
      />

      <div className="mt-6">
        <DataTable
          rows={result.rows}
          hrefFor={(row) => adminRoutes.product(row.id)}
          emptyMessage="Aucun produit ne correspond à cette recherche."
          caption="Catalogue produits"
          columns={[
            {
              key: 'name',
              header: 'Produit',
              cell: (row) => (
                <span>
                  {row.name}
                  {row.isFeatured ? (
                    <span className="ms-2 text-[10px] uppercase tracking-[0.12em] text-[var(--color-gold-deep)]">
                      Signature
                    </span>
                  ) : null}
                </span>
              ),
            },
            {
              key: 'category',
              header: 'Catégorie',
              cell: (row) => row.categoryName ?? <span className="text-[var(--surface-muted)]">—</span>,
            },
            {
              key: 'state',
              header: 'État',
              cell: (row) => (
                <StatusBadge
                  tone={row.state === 'PUBLISHED' ? 'positive' : row.state === 'DRAFT' ? 'caution' : 'neutral'}
                >
                  {STATE_LABEL[row.state] ?? row.state}
                </StatusBadge>
              ),
            },
            {
              key: 'variants',
              header: 'Formats',
              align: 'end',
              cell: (row) => <span className="tabular-nums">{row.variantCount}</span>,
            },
            {
              key: 'price',
              header: 'Prix',
              align: 'end',
              cell: (row) =>
                row.minPrice ? (
                  <span className="tabular-nums">{formatMoney(row.minPrice, 'fr')}</span>
                ) : (
                  <span className="text-[var(--surface-muted)]">—</span>
                ),
            },
            {
              key: 'stock',
              header: 'Stock',
              align: 'end',
              cell: (row) => (
                <span className={row.totalStock === 0 ? 'text-[var(--color-critical)]' : 'tabular-nums'}>
                  {row.totalStock}
                </span>
              ),
            },
          ]}
        />

        <Pagination
          page={result.page}
          pageCount={result.pageCount}
          hrefFor={hrefFor}
          labels={{ previous: 'Précédent', next: 'Suivant', nav: 'Pagination des produits', page: 'Page' }}
        />
      </div>

      <p className="mt-8 text-xs text-[var(--surface-muted)]">
        Un produit archivé reste lié à ses commandes passées :{' '}
        <Link href={adminRoutes.audit} className="underline underline-offset-4">
          le journal
        </Link>{' '}
        conserve qui a modifié quoi.
      </p>
    </AdminPage>
  );
}
