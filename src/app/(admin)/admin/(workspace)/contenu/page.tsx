import { sql } from 'kysely';
import { requirePermission } from '@/modules/admin/guard';
import { BLOCK_LABELS, listContentBlocks } from '@/modules/admin/content';
import { db } from '@/db/client';
import { AdminPage } from '@/components/admin/AdminPage';
import { ContentBlockEditor } from '@/components/admin/ContentBlockEditor';

export const dynamic = 'force-dynamic';

const LOCALES = ['FR', 'EN', 'AR'] as const;

export default async function AdminContentPage() {
  await requirePermission('content.write');

  const [blocks, products] = await Promise.all([
    listContentBlocks('home'),
    db
      .selectFrom('products as p')
      .leftJoin('product_translations as t', (join) =>
        join.onRef('t.product_id', '=', 'p.id').on('t.locale', '=', 'FR'))
      .select(['p.slug', sql<string>`COALESCE(t.name, p.slug)`.as('name')])
      .where('p.state', '=', 'PUBLISHED')
      .where('p.deleted_at', 'is', null)
      .orderBy('p.position')
      .execute(),
  ]);

  return (
    <AdminPage
      title="Contenu de l’accueil"
      description="Chaque bloc de la page d’accueil, dans les trois langues. Un bloc masqué disparaît du site sans être supprimé."
    >
      <div className="flex flex-col gap-6">
        {blocks.map((block) => (
          <ContentBlockEditor
            key={block.id}
            productOptions={products}
            block={{
              id: block.id,
              kind: block.kind,
              label: BLOCK_LABELS[block.kind] ?? block.kind,
              isVisible: block.isVisible,
              position: block.position,
              productSlug:
                typeof block.payload.productSlug === 'string' ? block.payload.productSlug : null,
              translations: LOCALES.map((locale) => {
                const existing = block.translations.find((entry) => entry.locale === locale);
                return {
                  locale,
                  eyebrow: existing?.eyebrow ?? '',
                  heading: existing?.heading ?? '',
                  body: existing?.body ?? '',
                  ctaLabel: existing?.ctaLabel ?? '',
                  ctaHref: existing?.ctaHref ?? '',
                };
              }),
            }}
          />
        ))}
      </div>
    </AdminPage>
  );
}
