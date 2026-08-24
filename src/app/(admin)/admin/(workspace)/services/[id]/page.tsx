import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requirePermission } from '@/modules/admin/guard';
import { getServiceForEdit, listPickupPointOptions } from '@/modules/admin/services';
import { AdminPage } from '@/components/admin/AdminPage';
import { ServiceForm } from '@/components/admin/ServiceForm';
import { adminRoutes } from '@/lib/routes';
import { toIsoDate, businessDateParts } from '@/lib/tz';

export const dynamic = 'force-dynamic';

const LOCALES = ['FR', 'EN', 'AR'] as const;

const pad = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

export default async function AdminServiceEditPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission('service.write');
  const { id } = await params;

  const [service, locations] = await Promise.all([getServiceForEdit(id), listPickupPointOptions()]);
  if (!service) notFound();

  const frenchName =
    service.translations.find((entry) => entry.locale === 'FR')?.name ?? service.slug;

  return (
    <AdminPage
      title={frenchName}
      description={`/services/${service.slug}`}
      actions={
        <Link
          href={`/fr/services/${service.slug}`}
          target="_blank"
          rel="noreferrer"
          className="text-xs uppercase tracking-[0.12em] underline underline-offset-4"
        >
          Voir sur le site
        </Link>
      }
    >
      <ServiceForm
        locations={locations}
        redirectTo={adminRoutes.services}
        initial={{
          id: service.id,
          slug: service.slug,
          state: service.state as 'DRAFT' | 'PUBLISHED' | 'ARCHIVED',
          durationMin: String(service.durationMin),
          capacity: String(service.capacity),
          price: service.price ?? '',
          bufferMin: String(service.bufferMin),
          leadTimeHours: String(service.leadTimeHours),
          horizonDays: String(service.horizonDays),
          locationId: service.locationId ?? '',
          position: String(service.position),
          translations: LOCALES.map((locale) => {
            const existing = service.translations.find((entry) => entry.locale === locale);
            return {
              locale,
              name: existing?.name ?? '',
              tagline: existing?.tagline ?? '',
              description: existing?.description ?? '',
              preparation: existing?.preparation ?? '',
            };
          }),
          rules: service.rules.map((rule) => ({
            key: rule.id,
            weekday: String(rule.weekday),
            start: pad(rule.startMin),
            end: pad(rule.endMin),
            every: String(rule.slotEveryMin),
          })),
          exceptions: service.exceptions.map((exception) => ({
            id: exception.id,
            date: toIsoDate(businessDateParts(exception.date)),
            isOpen: exception.isOpen,
            reason: exception.reason,
          })),
        }}
      />
    </AdminPage>
  );
}
