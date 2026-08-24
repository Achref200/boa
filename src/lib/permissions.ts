/**
 * Capability-based authorization, defined once.
 *
 * v1 ships a single administrator, but the model is already per-permission so
 * "order manager" or "content manager" is a row in `role_permissions`, not a
 * refactor. Nothing in the codebase checks a role name; everything checks a
 * capability.
 */
export const PERMISSIONS = {
  'product.read': 'Consulter les produits',
  'product.write': 'Créer et modifier les produits',
  'product.publish': 'Publier et dépublier les produits',
  'catalog.write': 'Gérer catégories, collections, besoins et rituels',
  'inventory.write': 'Ajuster les stocks',
  'order.read': 'Consulter les commandes',
  'order.write': 'Modifier le statut et les notes des commandes',
  'order.refund': 'Rembourser une commande',
  'reservation.read': 'Consulter les réservations',
  'reservation.write': 'Gérer les réservations et les disponibilités',
  'service.write': 'Gérer les services',
  'customer.read': 'Consulter les clients',
  'customer.write': 'Modifier les clients',
  'content.write': 'Gérer le contenu éditorial et les bannières',
  'discount.write': 'Gérer les remises',
  'shipping.write': 'Gérer les zones de livraison',
  'settings.write': 'Modifier les réglages du site',
  'admin.manage': 'Gérer les administrateurs et les rôles',
  'audit.read': 'Consulter le journal',
} as const;

export type Permission = keyof typeof PERMISSIONS;
export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

/** Role blueprints. Seeding creates the first; the rest are ready when BOA grows. */
export const ROLE_BLUEPRINTS: { key: string; label: string; permissions: Permission[] }[] = [
  { key: 'super_admin', label: 'Super administrateur', permissions: ALL_PERMISSIONS },
  {
    key: 'catalog_manager',
    label: 'Responsable catalogue',
    permissions: [
      'product.read', 'product.write', 'product.publish',
      'catalog.write', 'inventory.write', 'content.write',
    ],
  },
  {
    key: 'order_manager',
    label: 'Responsable commandes',
    permissions: ['order.read', 'order.write', 'customer.read', 'product.read', 'inventory.write'],
  },
  {
    key: 'reservation_manager',
    label: 'Responsable réservations',
    permissions: ['reservation.read', 'reservation.write', 'service.write', 'customer.read'],
  },
];

export type Actor = { id: string; roleKey: string; permissions: ReadonlySet<Permission> };

export const can = (actor: Actor | null, permission: Permission): boolean =>
  actor?.permissions.has(permission) ?? false;

export function assertCan(actor: Actor | null, permission: Permission): asserts actor is Actor {
  if (!can(actor, permission)) {
    const error = new Error(`Missing permission: ${permission}`);
    error.name = 'ForbiddenError';
    throw error;
  }
}
