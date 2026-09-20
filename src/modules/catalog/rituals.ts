import 'server-only';
import { sql } from 'kysely';
import { unstable_cache } from 'next/cache';
import { db } from '@/db/client';
import { withDbFallback } from '@/db/build-guard';
import { dbLocale, DEFAULT_LOCALE, type AppLocale } from '@/i18n/config';
import { addMoney } from '@/lib/money';
import type { MoneyString } from '@/lib/money';
import { CATALOG_TAG } from './service';

export type RitualStepView = {
  id: string;
  position: number;
  title: string;
  body: string | null;
  product: {
    id: string;
    slug: string;
    name: string;
    imagePath: string | null;
    variantId: string;
    price: MoneyString;
    inStock: boolean;
  } | null;
};

export type RitualView = {
  id: string;
  slug: string;
  name: string;
  intro: string | null;
  coverPath: string | null;
  steps: RitualStepView[];
  total: MoneyString;
};

async function fetchRituals(locale: AppLocale, limit: number): Promise<RitualView[]> {
  const requested = dbLocale(locale);
  const fallback = dbLocale(DEFAULT_LOCALE);

  const rituals = await db
    .selectFrom('rituals as r')
    .leftJoin('ritual_translations as t', (join) =>
      join.onRef('t.ritual_id', '=', 'r.id').on('t.locale', '=', requested))
    .leftJoin('ritual_translations as f', (join) =>
      join.onRef('f.ritual_id', '=', 'r.id').on('f.locale', '=', fallback))
    .where('r.state', '=', 'PUBLISHED')
    .select([
      'r.id', 'r.slug', 'r.cover_path as coverPath',
      sql<string>`COALESCE(t.name, f.name, r.slug)`.as('name'),
      sql<string | null>`COALESCE(t.intro, f.intro)`.as('intro'),
    ])
    .orderBy('r.position')
    .limit(limit)
    .execute();

  if (rituals.length === 0) return [];

  const ritualIds = rituals.map((r) => r.id);

  // One query for every step of every ritual on the page.
  const steps = await db
    .selectFrom('ritual_steps as s')
    .leftJoin('ritual_step_translations as st', (join) =>
      join.onRef('st.step_id', '=', 's.id').on('st.locale', '=', requested))
    .leftJoin('ritual_step_translations as sf', (join) =>
      join.onRef('sf.step_id', '=', 's.id').on('sf.locale', '=', fallback))
    .leftJoin('products as p', (join) =>
      join.onRef('p.id', '=', 's.product_id').on('p.state', '=', 'PUBLISHED').on('p.deleted_at', 'is', null))
    .leftJoin('product_translations as pt', (join) =>
      join.onRef('pt.product_id', '=', 'p.id').on('pt.locale', '=', requested))
    .leftJoin('product_translations as pf', (join) =>
      join.onRef('pf.product_id', '=', 'p.id').on('pf.locale', '=', fallback))
    .where('s.ritual_id', 'in', ritualIds)
    .select((eb) => [
      's.id', 's.ritual_id as ritualId', 's.position',
      sql<string>`COALESCE(st.title, sf.title, '')`.as('title'),
      sql<string | null>`COALESCE(st.body, sf.body)`.as('body'),
      'p.id as productId', 'p.slug as productSlug',
      sql<string | null>`COALESCE(pt.name, pf.name, p.slug)`.as('productName'),
      eb.selectFrom('product_media as m').select('m.path')
        .whereRef('m.product_id', '=', 'p.id').orderBy('m.position').limit(1).as('imagePath'),
      eb.selectFrom('product_variants as v').select('v.id')
        .whereRef('v.product_id', '=', 'p.id').where('v.is_active', '=', true)
        .orderBy('v.position').limit(1).as('variantId'),
      eb.selectFrom('product_variants as v2').select('v2.price')
        .whereRef('v2.product_id', '=', 'p.id').where('v2.is_active', '=', true)
        .orderBy('v2.position').limit(1).as('price'),
      eb.selectFrom('product_variants as v3').select(sql<number>`MAX(CASE WHEN v3.stock > 0 OR v3.allow_backorder = 1 THEN 1 ELSE 0 END)`.as('flag'))
        .whereRef('v3.product_id', '=', 'p.id').where('v3.is_active', '=', true).as('inStockFlag'),
    ])
    .orderBy('s.position')
    .execute();

  return rituals.map((ritual) => {
    const own = steps
      .filter((step) => step.ritualId === ritual.id)
      .map<RitualStepView>((step) => ({
        id: step.id,
        position: step.position,
        title: step.title,
        body: step.body,
        product:
          step.productId && step.variantId && step.price
            ? {
                id: step.productId,
                slug: step.productSlug ?? '',
                name: step.productName ?? '',
                imagePath: step.imagePath ?? null,
                variantId: step.variantId,
                price: step.price,
                inStock: Number(step.inStockFlag ?? 0) === 1,
              }
            : null,
      }));

    const prices = own.map((step) => step.product?.price).filter((p): p is MoneyString => Boolean(p));

    return {
      ...ritual,
      steps: own,
      total: prices.length > 0 ? addMoney(...prices) : '0.000',
    };
  });
}

export const getRituals = (locale: AppLocale, limit = 6) =>
  unstable_cache(
    () => withDbFallback([], () => fetchRituals(locale, limit)),
    ['rituals', locale, String(limit)],
    {
      tags: [CATALOG_TAG],
      revalidate: 3600,
    },
  )();

export async function getRitual(locale: AppLocale, slug: string): Promise<RitualView | null> {
  const all = await getRituals(locale, 50);
  return all.find((ritual) => ritual.slug === slug) ?? null;
}
