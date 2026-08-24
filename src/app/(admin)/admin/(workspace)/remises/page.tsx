import { requirePermission } from '@/modules/admin/guard';
import { listDiscounts } from '@/modules/admin/commerce-settings';
import { AdminPage } from '@/components/admin/AdminPage';
import { DiscountManager } from '@/components/admin/CommerceSettings';

export const dynamic = 'force-dynamic';

export default async function AdminDiscountsPage() {
  await requirePermission('discount.write');
  const discounts = await listDiscounts();

  return (
    <AdminPage
      title="Remises"
      description="Codes promotionnels. Le compteur d’utilisations est tenu par le système : il ne peut pas être modifié à la main."
      wide
    >
      <DiscountManager discounts={discounts} />
    </AdminPage>
  );
}
