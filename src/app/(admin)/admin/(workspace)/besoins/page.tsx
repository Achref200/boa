import { requirePermission } from '@/modules/admin/guard';
import { listTaxonomy } from '@/modules/admin/taxonomy-crud';
import { AdminPage } from '@/components/admin/AdminPage';
import { TaxonomyManager, type TaxonomyItem } from '@/components/admin/TaxonomyManager';

export const dynamic = 'force-dynamic';

export default async function AdminNeedsPage() {
  await requirePermission('catalog.write');
  const items = (await listTaxonomy('needs')) as TaxonomyItem[];

  return (
    <AdminPage
      title="Besoins"
      description="Le vocabulaire par lequel les clientes entrent dans le catalogue. Ces entrées alimentent le bloc « Par besoin » de l’accueil et les filtres."
    >
      <TaxonomyManager
        kind="needs"
        items={items}
        showIntro={false}
        labels={{
          singular: 'Nouveau besoin',
          usage: '{count} produit(s)',
          empty: 'Aucun besoin défini.',
        }}
      />
    </AdminPage>
  );
}
