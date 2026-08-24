import { requirePermission } from '@/modules/admin/guard';
import { EDITABLE_SETTINGS, getSettingsMap } from '@/modules/admin/content';
import { AdminPage, Panel } from '@/components/admin/AdminPage';
import { SettingsForm } from '@/components/admin/SettingsForm';

export const dynamic = 'force-dynamic';

export default async function AdminSettingsPage() {
  await requirePermission('settings.write');
  const values = await getSettingsMap();

  return (
    <AdminPage
      title="Réglages"
      description="Les informations de BOA affichées sur le site. Un champ laissé vide n’affiche rien : rien n’est inventé à sa place."
    >
      <Panel>
        <SettingsForm fields={EDITABLE_SETTINGS} values={values} />
      </Panel>
    </AdminPage>
  );
}
