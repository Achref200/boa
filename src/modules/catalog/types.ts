import type { MoneyString } from '@/lib/money';

export type MediaRef = {
  path: string;
  alt: string | null;
  width: number | null;
  height: number | null;
};

export type ProductCard = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  categorySlug: string | null;
  priceFrom: MoneyString;
  compareAtFrom: MoneyString | null;
  formatCount: number;
  inStock: boolean;
  isProfessional: boolean;
  image: MediaRef | null;
};

export type ProductVariantView = {
  id: string;
  sku: string;
  format: string;
  price: MoneyString;
  compareAtPrice: MoneyString | null;
  stock: number;
  lowStockAt: number;
  allowBackorder: boolean;
  isActive: boolean;
};

export type ProductDetail = ProductCard & {
  reference: string | null;
  description: string | null;
  usage: string | null;
  composition: string | null;
  precautions: string | null;
  storage: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  categoryName: string | null;
  needs: { slug: string; name: string }[];
  variants: ProductVariantView[];
  media: MediaRef[];
  updatedAt: Date;
};

export type CategoryNode = {
  id: string;
  slug: string;
  name: string;
  intro: string | null;
  children: CategoryNode[];
};

export type NeedView = { id: string; slug: string; name: string; tagline: string | null };

export type Navigation = {
  categories: CategoryNode[];
  needs: NeedView[];
};

export type ProductSort = 'relevance' | 'newest' | 'price_asc' | 'price_desc';

export type ProductQuery = {
  /** A category page passes its own slug plus its children, so a parent lists its whole branch. */
  categorySlugs?: string[] | undefined;
  needSlugs?: string[] | undefined;
  collectionSlug?: string | undefined;
  search?: string | undefined;
  inStockOnly?: boolean | undefined;
  minPrice?: MoneyString | undefined;
  maxPrice?: MoneyString | undefined;
  includeProfessional?: boolean | undefined;
  sort?: ProductSort | undefined;
  page?: number | undefined;
  perPage?: number | undefined;
};

export type Paginated<T> = {
  items: T[];
  total: number;
  page: number;
  perPage: number;
  pageCount: number;
};
