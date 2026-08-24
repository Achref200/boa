import { requirePermission } from '@/modules/admin/guard';
import { listAudit } from '@/modules/audit/service';
import { AdminPage } from '@/components/admin/AdminPage';
import { DataTable } from '@/components/admin/DataTable';
import { Pagination } from '@/components/ui/Pagination';
import { adminRoutes } from '@/lib/routes';
import { formatDateTime } from '@/lib/datetime';

export const dynamic = 'force-dynamic';

const ACTION_FR: Record<string, string> = {
  'product.create': 'Produit créé',
  'product.update': 'Produit modifié',
  'product.state_change': 'État du produit',
  'product.archive': 'Produit archivé',
  'inventory.adjust': 'Stock ajusté',
  'media.upload': 'Visuel ajouté',
  'media.update': 'Visuels modifiés',
  'media.delete': 'Visuel supprimé',
  'order.status_change': 'Statut de commande',
  'order.payment_change': 'Statut de paiement',
  'reservation.status_change': 'Statut de réservation',
  'availability.exception': 'Disponibilité modifiée',
  'availability.exception_removed': 'Disponibilité rétablie',
  'content.update': 'Contenu modifié',
  'settings.update': 'Réglages modifiés',
};

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requirePermission('audit.read');
  const query = await searchParams;
  const result = await listAudit({ page: Number.parseInt(query.page ?? '1', 10) || 1 });
  const pageCount = Math.max(1, Math.ceil(result.total / result.perPage));

  return (
    <AdminPage
      title="Journal"
      description="Qui a modifié quoi, et quand. Le journal est en écriture seule : aucune entrée ne peut être supprimée depuis l’application."
      wide
    >
      <DataTable
        rows={result.rows.map((row) => ({ ...row, id: String(row.id) }))}
        emptyMessage="Aucune action enregistrée pour le moment."
        caption="Journal des actions administratives"
        columns={[
          {
            key: 'createdAt',
            header: 'Quand',
            cell: (row) => <span className="tabular-nums">{formatDateTime(row.createdAt)}</span>,
          },
          { key: 'admin', header: 'Par', cell: (row) => row.adminName ?? '—' },
          { key: 'action', header: 'Action', cell: (row) => ACTION_FR[row.action] ?? row.action },
          {
            key: 'entity',
            header: 'Objet',
            cell: (row) => (
              <span className="text-xs text-[var(--surface-muted)]">
                {row.entity} · {row.entityId.slice(0, 8)}…
              </span>
            ),
          },
          {
            key: 'summary',
            header: 'Détail',
            cell: (row) => <span className="text-xs">{row.summary ?? '—'}</span>,
          },
        ]}
      />

      <Pagination
        page={result.page}
        pageCount={pageCount}
        hrefFor={(page) => (page > 1 ? `${adminRoutes.audit}?page=${page}` : adminRoutes.audit)}
        labels={{ previous: 'Précédent', next: 'Suivant', nav: 'Pagination du journal', page: 'Page' }}
      />
    </AdminPage>
  );
}
