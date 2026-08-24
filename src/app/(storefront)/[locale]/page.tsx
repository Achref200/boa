import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/config';
import { getFeaturedProducts, getNeeds, getProduct } from '@/modules/catalog/service';
import { getRituals } from '@/modules/catalog/rituals';
import { getServices } from '@/modules/reservations/catalog';
import { getPageBlocks } from '@/modules/content/service';
import { Hero } from '@/components/store/home/Hero';
import { NeedsRow } from '@/components/store/home/NeedsRow';
import { SignatureRow } from '@/components/store/home/SignatureRow';
import { MaisonStrip } from '@/components/store/home/MaisonStrip';
import { RitualSequence } from '@/components/store/home/RitualSequence';
import { ServicesInvite } from '@/components/store/home/ServicesInvite';

/**
 * The homepage is composed from `content_blocks`, so BOA can reorder, hide or
 * rewrite any band from the admin without a deploy. Each renderer decides for
 * itself whether it has enough real content to appear at all — which is why an
 * unfinished catalogue produces a shorter page rather than a page of
 * placeholders.
 */
export const revalidate = 300;

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const [blocks, featured, needs, rituals, services] = await Promise.all([
    getPageBlocks(locale, 'home'),
    getFeaturedProducts(locale, 4),
    getNeeds(locale),
    getRituals(locale, 1),
    getServices(locale),
  ]);

  const byKind = new Map(blocks.map((block) => [block.kind, block]));
  const heroBlock = byKind.get('hero');

  const heroSlug =
    typeof heroBlock?.payload.productSlug === 'string' ? heroBlock.payload.productSlug : null;
  const heroDetail = heroSlug ? await getProduct(locale, heroSlug) : null;
  const heroCard = heroDetail ?? featured.items[0] ?? null;

  const signature = featured.items.filter((product) => product.slug !== heroCard?.slug).slice(0, 3);

  return (
    <>
      <Hero locale={locale} block={heroBlock} product={heroCard} />
      <NeedsRow locale={locale} needs={needs} block={byKind.get('needs')} />
      <SignatureRow locale={locale} products={signature} block={byKind.get('signature')} />
      <MaisonStrip locale={locale} block={byKind.get('maison')} />
      <RitualSequence locale={locale} ritual={rituals[0]} block={byKind.get('rituals')} />
      <ServicesInvite locale={locale} services={services} block={byKind.get('services')} />
    </>
  );
}
