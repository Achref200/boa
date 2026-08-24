import { requirePermission } from '@/modules/admin/guard';
import { listTaxonomy } from '@/modules/admin/taxonomy-crud';
import { AdminPage } from '@/components/admin/AdminPage';
import { TaxonomyManager, type TaxonomyItem } from '@/components/admin/TaxonomyManager';

export const dynamic = 'force-dynamic';

export default async function AdminCollectionsPage() {
  await requirePermission('catalog.write');
  const items = (await listTaxonomy('collections')) as TaxonomyItem[];

  return (
    <AdminPage
      title="Collections"
      description="Regroupements éditoriaux — saisonniers, coffrets, sélections. Les produits s’ajoutent depuis la fiche produit."
    >
      <TaxonomyManager
        kind="collections"
        items={items}
        labels={{
          singular: 'Nouvelle collection',
          usage: '{count} produit(s)',
          empty: 'Aucune collection pour le moment.',
        }}
      />
    </AdminPage>
  );
}
