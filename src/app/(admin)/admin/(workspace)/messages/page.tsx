import { requirePermission } from '@/modules/admin/guard';
import { listInquiries } from '@/modules/admin/people';
import { AdminPage } from '@/components/admin/AdminPage';
import { AdminFilters } from '@/components/admin/AdminFilters';
import { InquiryList } from '@/components/admin/InquiryList';
import { Pagination } from '@/components/ui/Pagination';
import { adminRoutes } from '@/lib/routes';

export const dynamic = 'force-dynamic';

export default async function AdminInquiriesPage({
  searchParams,
}: {
  searchParams: Promise<{ etat?: string; page?: string }>;
}) {
  await requirePermission('content.write');
  const query = await searchParams;
  const handled = query.etat === 'traites' ? true : query.etat === 'ouverts' ? false : undefined;

  const result = await listInquiries({
    handled,
    page: Number.parseInt(query.page ?? '1', 10) || 1,
  });

  return (
    <AdminPage title="Messages" description={`${result.total} message(s).`} wide>
      <AdminFilters
        basePath={adminRoutes.inquiries}
        searchValue=""
        searchLabel="Rechercher"
        selects={[
          {
            name: 'etat',
            label: 'État',
            value: query.etat ?? '',
            options: [
              { value: '', label: 'Tous' },
              { value: 'ouverts', label: 'À traiter' },
              { value: 'traites', label: 'Traités' },
            ],
          },
        ]}
      />

      <div className="mt-6">
        <InquiryList inquiries={result.rows} />
        <Pagination
          page={result.page}
          pageCount={result.pageCount}
          hrefFor={(page) =>
            page > 1 ? `${adminRoutes.inquiries}?page=${page}` : adminRoutes.inquiries
          }
          labels={{
            previous: 'Précédent',
            next: 'Suivant',
            nav: 'Pagination des messages',
            page: 'Page',
          }}
        />
      </div>
    </AdminPage>
  );
}
