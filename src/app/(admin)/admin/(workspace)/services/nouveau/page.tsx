import { requirePermission } from '@/modules/admin/guard';
import { listPickupPointOptions } from '@/modules/admin/services';
import { AdminPage } from '@/components/admin/AdminPage';
import { ServiceForm } from '@/components/admin/ServiceForm';
import { adminRoutes } from '@/lib/routes';

export const dynamic = 'force-dynamic';

export default async function AdminNewServicePage() {
  await requirePermission('service.write');
  const locations = await listPickupPointOptions();

  return (
    <AdminPage
      title="Nouveau service"
      description="Les fermetures exceptionnelles se paramètrent après le premier enregistrement."
    >
      <ServiceForm
        locations={locations}
        redirectTo={adminRoutes.services}
        initial={{
          slug: '',
          state: 'DRAFT',
          durationMin: '60',
          capacity: '1',
          price: '',
          bufferMin: '0',
          leadTimeHours: '12',
          horizonDays: '45',
          locationId: locations[0]?.id ?? '',
          position: '0',
          translations: (['FR', 'EN', 'AR'] as const).map((locale) => ({
            locale,
            name: '',
            tagline: '',
            description: '',
            preparation: '',
          })),
          rules: [
            { key: 'rule-0', weekday: '2', start: '09:00', end: '17:00', every: '60' },
          ],
          exceptions: [],
        }}
      />
    </AdminPage>
  );
}
