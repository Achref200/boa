import { requirePermission } from '@/modules/admin/guard';
import { listShippingZones, TUNISIAN_GOVERNORATES } from '@/modules/admin/commerce-settings';
import { AdminPage } from '@/components/admin/AdminPage';
import { ShippingZoneManager } from '@/components/admin/CommerceSettings';

export const dynamic = 'force-dynamic';

export default async function AdminShippingPage() {
  await requirePermission('shipping.write');
  const zones = await listShippingZones();

  return (
    <AdminPage
      title="Livraison"
      description="Les tarifs par gouvernorat. Un gouvernorat sans zone n’a pas d’option de livraison au paiement : la cliente se voit proposer le retrait."
      wide
    >
      <ShippingZoneManager zones={zones} governorates={TUNISIAN_GOVERNORATES} />
    </AdminPage>
  );
}
