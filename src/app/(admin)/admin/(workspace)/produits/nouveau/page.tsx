import { requirePermission } from '@/modules/admin/guard';
import { listCategoryOptions, listNeedOptions } from '@/modules/admin/taxonomy';
import { can } from '@/lib/permissions';
import { AdminPage } from '@/components/admin/AdminPage';
import { ProductForm } from '@/components/admin/ProductForm';
import { adminRoutes } from '@/lib/routes';

export const dynamic = 'force-dynamic';

export default async function AdminNewProductPage() {
  const admin = await requirePermission('product.write');
  const [categories, needs] = await Promise.all([listCategoryOptions(), listNeedOptions()]);

  return (
    <AdminPage
      title="Nouveau produit"
      description="Le produit est créé en brouillon : les visuels s’ajoutent après le premier enregistrement."
    >
      <ProductForm
        canPublish={can(admin, 'product.publish')}
        redirectTo={adminRoutes.products}
        categories={categories}
        needs={needs}
        initial={{
          slug: '',
          reference: '',
          categoryId: '',
          state: 'DRAFT',
          isFeatured: false,
          isProfessional: false,
          position: '0',
          needIds: [],
          translations: (['FR', 'EN', 'AR'] as const).map((locale) => ({
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
          })),
          variants: [
            {
              key: 'first',
              sku: '',
              format: '',
              price: '',
              compareAtPrice: '',
              stock: '0',
              lowStockAt: '5',
              allowBackorder: false,
              isActive: true,
            },
          ],
        }}
      />
    </AdminPage>
  );
}
