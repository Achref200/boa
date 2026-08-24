import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requirePermission } from '@/modules/admin/guard';
import { getProductForEdit } from '@/modules/admin/products';
import { listCategoryOptions, listNeedOptions } from '@/modules/admin/taxonomy';
import { can } from '@/lib/permissions';
import { AdminPage } from '@/components/admin/AdminPage';
import { ProductForm, type TranslationState } from '@/components/admin/ProductForm';
import { ProductMediaManager } from '@/components/admin/ProductMediaManager';
import { ProductDangerZone } from '@/components/admin/ProductDangerZone';
import { adminRoutes } from '@/lib/routes';

export const dynamic = 'force-dynamic';

const LOCALES = ['FR', 'EN', 'AR'] as const;

const emptyTranslation = (locale: (typeof LOCALES)[number]): TranslationState => ({
  locale,
  name: '',
  tagline: '',
  description: '',
  usage: '',
  composition: '',
  precautions: '',
  storage: '',
  metaTitle: '',
  metaDescription: '',
});

export default async function AdminProductEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const admin = await requirePermission('product.write');
  const { id } = await params;

  const [product, categories, needs] = await Promise.all([
    getProductForEdit(id),
    listCategoryOptions(),
    listNeedOptions(),
  ]);

  if (!product) notFound();

  const translations = LOCALES.map((locale) => {
    const existing = product.translations.find((entry) => entry.locale === locale);
    if (!existing) return emptyTranslation(locale);
    return {
      locale,
      name: existing.name ?? '',
      tagline: existing.tagline ?? '',
      description: existing.description ?? '',
      usage: existing.usage ?? '',
      composition: existing.composition ?? '',
      precautions: existing.precautions ?? '',
      storage: existing.storage ?? '',
      metaTitle: existing.metaTitle ?? '',
      metaDescription: existing.metaDescription ?? '',
    };
  });

  const frenchName = translations[0]?.name || product.slug;

  return (
    <AdminPage
      title={frenchName}
      description={`/${'produits'}/${product.slug}`}
      actions={
        <Link
          href={`/fr/produits/${product.slug}`}
          target="_blank"
          rel="noreferrer"
          className="text-xs uppercase tracking-[0.12em] underline underline-offset-4"
        >
          Voir sur le site
        </Link>
      }
    >
      <div className="flex flex-col gap-8">
        <ProductForm
          canPublish={can(admin, 'product.publish')}
          redirectTo={adminRoutes.products}
          categories={categories}
          needs={needs}
          initial={{
            id: product.id,
            slug: product.slug,
            reference: product.reference ?? '',
            categoryId: product.categoryId ?? '',
            state: product.state as 'DRAFT' | 'PUBLISHED' | 'ARCHIVED',
            isFeatured: product.isFeatured,
            isProfessional: product.isProfessional,
            position: String(product.position),
            needIds: product.needIds,
            translations,
            variants: product.variants.map((variant) => ({
              key: variant.id,
              id: variant.id,
              sku: variant.sku,
              format: variant.format,
              price: variant.price,
              compareAtPrice: variant.compareAtPrice ?? '',
              stock: String(variant.stock),
              lowStockAt: String(variant.lowStockAt),
              allowBackorder: variant.allowBackorder,
              isActive: variant.isActive,
            })),
          }}
        />

        <ProductMediaManager productId={product.id} media={product.media} />

        <ProductDangerZone productId={product.id} state={product.state} />
      </div>
    </AdminPage>
  );
}
