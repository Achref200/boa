import type { AppLocale } from '@/i18n/config';

/**
 * Every public URL is built here. Two reasons: the locale prefix is never
 * forgotten, and the French-language paths that make up BOA's information
 * architecture ("/soins", "/rituels") stay in one place if they ever change —
 * a redirect map beats a repository-wide find-and-replace.
 */
export const routes = {
  home: (l: AppLocale) => `/${l}`,
  shop: (l: AppLocale) => `/${l}/soins`,
  category: (l: AppLocale, slug: string) => `/${l}/soins/${slug}`,
  product: (l: AppLocale, slug: string) => `/${l}/produits/${slug}`,
  collection: (l: AppLocale, slug: string) => `/${l}/collections/${slug}`,
  rituals: (l: AppLocale) => `/${l}/rituels`,
  ritual: (l: AppLocale, slug: string) => `/${l}/rituels/${slug}`,
  services: (l: AppLocale) => `/${l}/services`,
  service: (l: AppLocale, slug: string) => `/${l}/services/${slug}`,
  book: (l: AppLocale, slug: string) => `/${l}/reserver/${slug}`,
  reservation: (l: AppLocale, reference: string) => `/${l}/reservation/${reference}`,
  professionals: (l: AppLocale) => `/${l}/professionnels`,
  house: (l: AppLocale) => `/${l}/maison-boa`,
  contact: (l: AppLocale) => `/${l}/contact`,
  cart: (l: AppLocale) => `/${l}/panier`,
  checkout: (l: AppLocale) => `/${l}/commande`,
  orderConfirmation: (l: AppLocale, reference: string) => `/${l}/commande/${reference}`,
  orderTracking: (l: AppLocale) => `/${l}/suivi`,
  account: (l: AppLocale) => `/${l}/compte`,
  accountOrders: (l: AppLocale) => `/${l}/compte/commandes`,
  accountReservations: (l: AppLocale) => `/${l}/compte/reservations`,
  accountAddresses: (l: AppLocale) => `/${l}/compte/adresses`,
  signIn: (l: AppLocale) => `/${l}/connexion`,
  signUp: (l: AppLocale) => `/${l}/inscription`,
  search: (l: AppLocale, term: string) => `/${l}/soins?q=${encodeURIComponent(term)}`,
} as const;

export const adminRoutes = {
  root: '/admin',
  signIn: '/admin/connexion',
  products: '/admin/produits',
  product: (id: string) => `/admin/produits/${id}`,
  newProduct: '/admin/produits/nouveau',
  categories: '/admin/categories',
  collections: '/admin/collections',
  rituals: '/admin/rituels',
  needs: '/admin/besoins',
  orders: '/admin/commandes',
  order: (id: string) => `/admin/commandes/${id}`,
  reservations: '/admin/reservations',
  services: '/admin/services',
  service: (id: string) => `/admin/services/${id}`,
  customers: '/admin/clients',
  content: '/admin/contenu',
  discounts: '/admin/remises',
  shipping: '/admin/livraison',
  inquiries: '/admin/messages',
  settings: '/admin/reglages',
  audit: '/admin/journal',
} as const;
