import { sql } from 'kysely';
import { requirePermission } from '@/modules/admin/guard';
import { listRituals } from '@/modules/admin/rituals';
import { db } from '@/db/client';
import { AdminPage } from '@/components/admin/AdminPage';
import { RitualManager, type RitualItem } from '@/components/admin/RitualManager';

export const dynamic = 'force-dynamic';

export default async function AdminRitualsPage() {
  await requirePermission('catalog.write');

  const [rituals, products] = await Promise.all([
    listRituals(),
    db
      .selectFrom('products as p')
      .leftJoin('product_translations as t', (join) =>
        join.onRef('t.product_id', '=', 'p.id').on('t.locale', '=', 'FR'))
      .select(['p.id', sql<string>`COALESCE(t.name, p.slug)`.as('name')])
      .where('p.deleted_at', 'is', null)
      .orderBy('p.position')
      .execute(),
  ]);

  return (
    <AdminPage
      title="Rituels"
      description="Des régimes ordonnés composés de vrais produits. C’est ce qui distingue BOA d’une boutique qui aligne des flacons."
      wide
    >
      <RitualManager rituals={rituals as RitualItem[]} products={products} />
    </AdminPage>
  );
}
