/**
 * French labels for database enums, in one place.
 *
 * The admin interface is French (that is the team's working language) while the
 * storefront is translated — so these live here rather than in the i18n
 * bundles, which exist for customer-facing copy.
 */
export const ORDER_STATUS_FR: Record<string, string> = {
  PENDING: 'En attente',
  CONFIRMED: 'Confirmée',
  PREPARING: 'En préparation',
  SHIPPED: 'Expédiée',
  READY_FOR_PICKUP: 'Prête au retrait',
  COMPLETED: 'Terminée',
  CANCELLED: 'Annulée',
  REFUNDED: 'Remboursée',
};

export const PAYMENT_STATUS_FR: Record<string, string> = {
  UNPAID: 'Non réglée',
  AUTHORIZED: 'Autorisée',
  PAID: 'Réglée',
  FAILED: 'Échouée',
  REFUNDED: 'Remboursée',
  CANCELLED: 'Annulée',
};

export const PAYMENT_METHOD_FR: Record<string, string> = {
  CASH_ON_DELIVERY: 'Paiement à la livraison',
  CASH_ON_PICKUP: 'Paiement au retrait',
  BANK_TRANSFER: 'Virement bancaire',
  ONLINE_GATEWAY: 'Paiement en ligne',
};

export const FULFILMENT_FR: Record<string, string> = {
  DELIVERY: 'Livraison à domicile',
  HAND_TO_HAND: 'Remise en main propre',
  STORE_PICKUP: 'Retrait en boutique',
};

export const RESERVATION_STATUS_FR: Record<string, string> = {
  PENDING: 'En attente',
  CONFIRMED: 'Confirmée',
  COMPLETED: 'Honorée',
  CANCELLED: 'Annulée',
  NO_SHOW: 'Non honorée',
};

export const PUBLISH_STATE_FR: Record<string, string> = {
  DRAFT: 'Brouillon',
  PUBLISHED: 'Publié',
  ARCHIVED: 'Archivé',
};

export const orderStatusTone = (status: string) =>
  status === 'COMPLETED' ? 'positive'
  : status === 'PENDING' ? 'caution'
  : status === 'CANCELLED' || status === 'REFUNDED' ? 'critical'
  : 'neutral';
