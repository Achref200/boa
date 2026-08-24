import 'server-only';
import { sql } from 'kysely';
import { db } from '@/db/client';

/** Flat lists for admin selects — labelled in French, the team's working language. */
export async function listCategoryOptions() {
  const rows = await db
    .selectFrom('categories as c')
    .leftJoin('category_translations as t', (join) =>
      join.onRef('t.category_id', '=', 'c.id').on('t.locale', '=', 'FR'))
    .leftJoin('categories as parent', 'parent.id', 'c.parent_id')
    .leftJoin('category_translations as pt', (join) =>
      join.onRef('pt.category_id', '=', 'parent.id').on('pt.locale', '=', 'FR'))
    .select([
      'c.id',
      sql<string>`CONCAT_WS(' › ', pt.name, COALESCE(t.name, c.slug))`.as('name'),
    ])
    .orderBy('parent.position')
    .orderBy('c.position')
    .execute();
  return rows;
}

export async function listNeedOptions() {
  return db
    .selectFrom('needs as n')
    .leftJoin('need_translations as t', (join) =>
      join.onRef('t.need_id', '=', 'n.id').on('t.locale', '=', 'FR'))
    .select(['n.id', sql<string>`COALESCE(t.name, n.slug)`.as('name')])
    .orderBy('n.position')
    .execute();
}
