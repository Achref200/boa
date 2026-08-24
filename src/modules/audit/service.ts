import 'server-only';
import { db } from '@/db/client';
import { toJsonColumn } from '@/lib/json';
import { clientIp } from '@/lib/request';

/**
 * Administrative changes are recorded with actor, entity and a field-level
 * diff. This is what makes "who unpublished this product?" answerable three
 * months later — and it is deliberately append-only: there is no update or
 * delete path for audit rows anywhere in the codebase.
 */
export type AuditInput = {
  adminId: string;
  action: string;
  entity: string;
  entityId: string;
  summary?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
};

/** Only the fields that actually changed, so the log stays readable. */
function diff(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined,
): Record<string, { from: unknown; to: unknown }> | null {
  if (!before && !after) return null;
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const key of keys) {
    const from = before?.[key];
    const to = after?.[key];
    if (JSON.stringify(from) !== JSON.stringify(to)) changes[key] = { from, to };
  }
  return Object.keys(changes).length > 0 ? changes : null;
}

export async function recordAudit(input: AuditInput): Promise<void> {
  const changes = diff(input.before, input.after);
  await db
    .insertInto('audit_logs')
    .values({
      admin_id: input.adminId,
      action: input.action,
      entity: input.entity,
      entity_id: input.entityId,
      summary: input.summary ?? null,
      diff: changes ? toJsonColumn(changes) : null,
      ip: await clientIp(),
    })
    .execute();
}

export async function listAudit(
  options: { page?: number; perPage?: number; entity?: string } = {},
) {
  const page = Math.max(1, options.page ?? 1);
  const perPage = Math.min(100, options.perPage ?? 50);

  let query = db
    .selectFrom('audit_logs as a')
    .leftJoin('admin_users as u', 'u.id', 'a.admin_id')
    .select([
      'a.id',
      'a.action',
      'a.entity',
      'a.entity_id as entityId',
      'a.summary',
      'a.created_at as createdAt',
      'u.name as adminName',
    ]);

  let counter = db.selectFrom('audit_logs').select((eb) => eb.fn.countAll<number>().as('count'));

  if (options.entity) {
    query = query.where('a.entity', '=', options.entity);
    counter = counter.where('entity', '=', options.entity);
  }

  const [rows, total] = await Promise.all([
    query.orderBy('a.created_at', 'desc').limit(perPage).offset((page - 1) * perPage).execute(),
    counter.executeTakeFirst(),
  ]);

  return { rows, total: Number(total?.count ?? 0), page, perPage };
}
