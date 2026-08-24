import { requirePermission } from '@/modules/admin/guard';
import { listTaxonomy } from '@/modules/admin/taxonomy-crud';
import { AdminPage } from '@/components/admin/AdminPage';
import { TaxonomyManager, type TaxonomyItem } from '@/components/admin/TaxonomyManager';

export const dynamic = 'force-dynamic';

export default async function AdminCategoriesPage() {
  await requirePermission('catalog.write');
  const items = (await listTaxonomy('categories')) as TaxonomyItem[];

  return (
    <AdminPage
      title="Catégories"
      description="L’arborescence du catalogue. Deux niveaux : une catégorie racine et ses sous-catégories."
    >
      <TaxonomyManager
        kind="categories"
        items={items}
        showParent
        labels={{
          singular: 'Nouvelle catégorie',
          usage: '{count} produit(s)',
          empty: 'Aucune catégorie pour le moment.',
        }}
      />
    </AdminPage>
  );
}
