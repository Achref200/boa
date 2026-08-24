/* eslint-disable */
// GENERATED FILE — do not edit by hand.
// Produced from the live schema by `npm run db:types`.
// The SQL under db/migrations is the source of truth.

import type { ColumnType, Generated, Insertable, Selectable, Updateable } from 'kysely';

export type Timestamp = ColumnType<Date, Date | string, Date | string>;

export interface AddressesTable {
  id: string;
  customer_id: string;
  label: Generated<string | null>;
  first_name: string;
  last_name: string;
  phone: string;
  line1: string;
  line2: Generated<string | null>;
  city: string;
  governorate: string;
  postal_code: Generated<string | null>;
  country: Generated<string>;
  is_default: Generated<boolean>;
  created_at: ColumnType<Date, Date | string | undefined, Date | string>;
  updated_at: ColumnType<Date, Date | string | undefined, Date | string>;
  deleted_at: ColumnType<Date | null, Date | string | null | undefined, Date | string | null>;
}
export type Address = Selectable<AddressesTable>;
export type NewAddress = Insertable<AddressesTable>;
export type AddressUpdate = Updateable<AddressesTable>;

export interface AdminSessionsTable {
  id: string;
  token_hash: string;
  admin_id: string;
  ip: Generated<string | null>;
  user_agent: Generated<string | null>;
  expires_at: ColumnType<Date, Date | string, Date | string>;
  revoked_at: ColumnType<Date | null, Date | string | null | undefined, Date | string | null>;
  created_at: ColumnType<Date, Date | string | undefined, Date | string>;
}
export type AdminSession = Selectable<AdminSessionsTable>;
export type NewAdminSession = Insertable<AdminSessionsTable>;
export type AdminSessionUpdate = Updateable<AdminSessionsTable>;

export interface AdminUsersTable {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  status: Generated<'ACTIVE' | 'SUSPENDED'>;
  role_id: number;
  last_login_at: ColumnType<Date | null, Date | string | null | undefined, Date | string | null>;
  failed_logins: Generated<number>;
  locked_until: ColumnType<Date | null, Date | string | null | undefined, Date | string | null>;
  created_at: ColumnType<Date, Date | string | undefined, Date | string>;
  updated_at: ColumnType<Date, Date | string | undefined, Date | string>;
}
export type AdminUser = Selectable<AdminUsersTable>;
export type NewAdminUser = Insertable<AdminUsersTable>;
export type AdminUserUpdate = Updateable<AdminUsersTable>;

export interface AnnouncementTranslationsTable {
  id: string;
  announcement_id: string;
  locale: 'FR' | 'EN' | 'AR';
  message: string;
  href: Generated<string | null>;
}
export type AnnouncementTranslation = Selectable<AnnouncementTranslationsTable>;
export type NewAnnouncementTranslation = Insertable<AnnouncementTranslationsTable>;
export type AnnouncementTranslationUpdate = Updateable<AnnouncementTranslationsTable>;

export interface AnnouncementsTable {
  id: string;
  is_active: Generated<boolean>;
  starts_at: ColumnType<Date | null, Date | string | null | undefined, Date | string | null>;
  ends_at: ColumnType<Date | null, Date | string | null | undefined, Date | string | null>;
}
export type Announcement = Selectable<AnnouncementsTable>;
export type NewAnnouncement = Insertable<AnnouncementsTable>;
export type AnnouncementUpdate = Updateable<AnnouncementsTable>;

export interface AuditLogsTable {
  id: Generated<string>;
  admin_id: Generated<string | null>;
  action: string;
  entity: string;
  entity_id: string;
  summary: Generated<string | null>;
  diff: Generated<unknown | null>;
  ip: Generated<string | null>;
  created_at: ColumnType<Date, Date | string | undefined, Date | string>;
}
export type AuditLog = Selectable<AuditLogsTable>;
export type NewAuditLog = Insertable<AuditLogsTable>;
export type AuditLogUpdate = Updateable<AuditLogsTable>;

export interface AvailabilityExceptionsTable {
  id: string;
  service_id: string;
  date: ColumnType<Date, Date | string, Date | string>;
  is_open: Generated<boolean>;
  start_min: Generated<number | null>;
  end_min: Generated<number | null>;
  reason: Generated<string | null>;
}
export type AvailabilityException = Selectable<AvailabilityExceptionsTable>;
export type NewAvailabilityException = Insertable<AvailabilityExceptionsTable>;
export type AvailabilityExceptionUpdate = Updateable<AvailabilityExceptionsTable>;

export interface AvailabilityRulesTable {
  id: string;
  service_id: string;
  weekday: number;
  start_min: number;
  end_min: number;
  slot_every_min: Generated<number>;
  valid_from: ColumnType<Date | null, Date | string | null | undefined, Date | string | null>;
  valid_until: ColumnType<Date | null, Date | string | null | undefined, Date | string | null>;
  is_active: Generated<boolean>;
}
export type AvailabilityRule = Selectable<AvailabilityRulesTable>;
export type NewAvailabilityRule = Insertable<AvailabilityRulesTable>;
export type AvailabilityRuleUpdate = Updateable<AvailabilityRulesTable>;

export interface CartItemsTable {
  id: string;
  cart_id: string;
  variant_id: string;
  quantity: number;
  added_at: ColumnType<Date, Date | string | undefined, Date | string>;
}
export type CartItem = Selectable<CartItemsTable>;
export type NewCartItem = Insertable<CartItemsTable>;
export type CartItemUpdate = Updateable<CartItemsTable>;

export interface CartsTable {
  id: string;
  token: string;
  customer_id: Generated<string | null>;
  currency: Generated<string>;
  created_at: ColumnType<Date, Date | string | undefined, Date | string>;
  updated_at: ColumnType<Date, Date | string | undefined, Date | string>;
  expires_at: ColumnType<Date, Date | string, Date | string>;
  converted_at: ColumnType<Date | null, Date | string | null | undefined, Date | string | null>;
}
export type Cart = Selectable<CartsTable>;
export type NewCart = Insertable<CartsTable>;
export type CartUpdate = Updateable<CartsTable>;

export interface CategoriesTable {
  id: string;
  slug: string;
  parent_id: Generated<string | null>;
  position: Generated<number>;
  state: Generated<'DRAFT' | 'PUBLISHED' | 'ARCHIVED'>;
  image_path: Generated<string | null>;
  created_at: ColumnType<Date, Date | string | undefined, Date | string>;
  updated_at: ColumnType<Date, Date | string | undefined, Date | string>;
}
export type Category = Selectable<CategoriesTable>;
export type NewCategory = Insertable<CategoriesTable>;
export type CategoryUpdate = Updateable<CategoriesTable>;

export interface CategoryTranslationsTable {
  id: string;
  category_id: string;
  locale: 'FR' | 'EN' | 'AR';
  name: string;
  intro: Generated<string | null>;
  meta_title: Generated<string | null>;
  meta_description: Generated<string | null>;
}
export type CategoryTranslation = Selectable<CategoryTranslationsTable>;
export type NewCategoryTranslation = Insertable<CategoryTranslationsTable>;
export type CategoryTranslationUpdate = Updateable<CategoryTranslationsTable>;

export interface CollectionProductsTable {
  collection_id: string;
  product_id: string;
  position: Generated<number>;
}
export type CollectionProduct = Selectable<CollectionProductsTable>;
export type NewCollectionProduct = Insertable<CollectionProductsTable>;
export type CollectionProductUpdate = Updateable<CollectionProductsTable>;

export interface CollectionTranslationsTable {
  id: string;
  collection_id: string;
  locale: 'FR' | 'EN' | 'AR';
  name: string;
  intro: Generated<string | null>;
  meta_title: Generated<string | null>;
  meta_description: Generated<string | null>;
}
export type CollectionTranslation = Selectable<CollectionTranslationsTable>;
export type NewCollectionTranslation = Insertable<CollectionTranslationsTable>;
export type CollectionTranslationUpdate = Updateable<CollectionTranslationsTable>;

export interface CollectionsTable {
  id: string;
  slug: string;
  state: Generated<'DRAFT' | 'PUBLISHED' | 'ARCHIVED'>;
  position: Generated<number>;
  cover_path: Generated<string | null>;
  created_at: ColumnType<Date, Date | string | undefined, Date | string>;
  updated_at: ColumnType<Date, Date | string | undefined, Date | string>;
}
export type Collection = Selectable<CollectionsTable>;
export type NewCollection = Insertable<CollectionsTable>;
export type CollectionUpdate = Updateable<CollectionsTable>;

export interface ContentBlockTranslationsTable {
  id: string;
  block_id: string;
  locale: 'FR' | 'EN' | 'AR';
  eyebrow: Generated<string | null>;
  heading: Generated<string | null>;
  body: Generated<string | null>;
  cta_label: Generated<string | null>;
  cta_href: Generated<string | null>;
}
export type ContentBlockTranslation = Selectable<ContentBlockTranslationsTable>;
export type NewContentBlockTranslation = Insertable<ContentBlockTranslationsTable>;
export type ContentBlockTranslationUpdate = Updateable<ContentBlockTranslationsTable>;

export interface ContentBlocksTable {
  id: string;
  page: Generated<string>;
  kind: string;
  position: Generated<number>;
  is_visible: Generated<boolean>;
  payload: Generated<unknown | null>;
  media_path: Generated<string | null>;
  created_at: ColumnType<Date, Date | string | undefined, Date | string>;
  updated_at: ColumnType<Date, Date | string | undefined, Date | string>;
}
export type ContentBlock = Selectable<ContentBlocksTable>;
export type NewContentBlock = Insertable<ContentBlocksTable>;
export type ContentBlockUpdate = Updateable<ContentBlocksTable>;

export interface CustomerSessionsTable {
  id: string;
  token_hash: string;
  customer_id: string;
  expires_at: ColumnType<Date, Date | string, Date | string>;
  revoked_at: ColumnType<Date | null, Date | string | null | undefined, Date | string | null>;
  created_at: ColumnType<Date, Date | string | undefined, Date | string>;
}
export type CustomerSession = Selectable<CustomerSessionsTable>;
export type NewCustomerSession = Insertable<CustomerSessionsTable>;
export type CustomerSessionUpdate = Updateable<CustomerSessionsTable>;

export interface CustomersTable {
  id: string;
  email: string;
  password_hash: Generated<string | null>;
  first_name: Generated<string | null>;
  last_name: Generated<string | null>;
  phone: Generated<string | null>;
  locale: Generated<'FR' | 'EN' | 'AR'>;
  accepts_marketing: Generated<boolean>;
  email_verified_at: ColumnType<Date | null, Date | string | null | undefined, Date | string | null>;
  failed_logins: Generated<number>;
  locked_until: ColumnType<Date | null, Date | string | null | undefined, Date | string | null>;
  created_at: ColumnType<Date, Date | string | undefined, Date | string>;
  updated_at: ColumnType<Date, Date | string | undefined, Date | string>;
  deleted_at: ColumnType<Date | null, Date | string | null | undefined, Date | string | null>;
}
export type Customer = Selectable<CustomersTable>;
export type NewCustomer = Insertable<CustomersTable>;
export type CustomerUpdate = Updateable<CustomersTable>;

export interface DiscountsTable {
  id: string;
  code: string;
  kind: 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FREE_SHIPPING';
  value: Generated<string>;
  min_subtotal: Generated<string | null>;
  max_redemptions: Generated<number | null>;
  redemptions: Generated<number>;
  per_customer_limit: Generated<number | null>;
  starts_at: ColumnType<Date | null, Date | string | null | undefined, Date | string | null>;
  ends_at: ColumnType<Date | null, Date | string | null | undefined, Date | string | null>;
  is_active: Generated<boolean>;
  created_at: ColumnType<Date, Date | string | undefined, Date | string>;
  updated_at: ColumnType<Date, Date | string | undefined, Date | string>;
}
export type Discount = Selectable<DiscountsTable>;
export type NewDiscount = Insertable<DiscountsTable>;
export type DiscountUpdate = Updateable<DiscountsTable>;

export interface IdempotencyKeysTable {
  key: string;
  scope: string;
  result_id: Generated<string | null>;
  created_at: ColumnType<Date, Date | string | undefined, Date | string>;
  expires_at: ColumnType<Date, Date | string, Date | string>;
}
export type IdempotencyKey = Selectable<IdempotencyKeysTable>;
export type NewIdempotencyKey = Insertable<IdempotencyKeysTable>;
export type IdempotencyKeyUpdate = Updateable<IdempotencyKeysTable>;

export interface InquiriesTable {
  id: string;
  kind: Generated<'CONTACT' | 'PROFESSIONAL'>;
  name: string;
  email: string;
  phone: Generated<string | null>;
  company: Generated<string | null>;
  subject: Generated<string | null>;
  message: string;
  is_handled: Generated<boolean>;
  created_at: ColumnType<Date, Date | string | undefined, Date | string>;
}
export type Inquiry = Selectable<InquiriesTable>;
export type NewInquiry = Insertable<InquiriesTable>;
export type InquiryUpdate = Updateable<InquiriesTable>;

export interface NeedTranslationsTable {
  id: string;
  need_id: string;
  locale: 'FR' | 'EN' | 'AR';
  name: string;
  tagline: Generated<string | null>;
}
export type NeedTranslation = Selectable<NeedTranslationsTable>;
export type NewNeedTranslation = Insertable<NeedTranslationsTable>;
export type NeedTranslationUpdate = Updateable<NeedTranslationsTable>;

export interface NeedsTable {
  id: string;
  slug: string;
  position: Generated<number>;
  state: Generated<'DRAFT' | 'PUBLISHED' | 'ARCHIVED'>;
}
export type Need = Selectable<NeedsTable>;
export type NewNeed = Insertable<NeedsTable>;
export type NeedUpdate = Updateable<NeedsTable>;

export interface OrderEventsTable {
  id: Generated<string>;
  order_id: string;
  type: string;
  message: Generated<string | null>;
  data: Generated<unknown | null>;
  actor: Generated<string | null>;
  created_at: ColumnType<Date, Date | string | undefined, Date | string>;
}
export type OrderEvent = Selectable<OrderEventsTable>;
export type NewOrderEvent = Insertable<OrderEventsTable>;
export type OrderEventUpdate = Updateable<OrderEventsTable>;

export interface OrderLinesTable {
  id: string;
  order_id: string;
  variant_id: Generated<string | null>;
  product_id: Generated<string | null>;
  sku: string;
  product_name: string;
  variant_format: string;
  image_path: Generated<string | null>;
  unit_price: string;
  quantity: number;
  line_total: string;
}
export type OrderLine = Selectable<OrderLinesTable>;
export type NewOrderLine = Insertable<OrderLinesTable>;
export type OrderLineUpdate = Updateable<OrderLinesTable>;

export interface OrdersTable {
  id: string;
  reference: string;
  customer_id: Generated<string | null>;
  status: Generated<'PENDING' | 'CONFIRMED' | 'PREPARING' | 'SHIPPED' | 'READY_FOR_PICKUP' | 'COMPLETED' | 'CANCELLED' | 'REFUNDED'>;
  fulfilment: 'DELIVERY' | 'HAND_TO_HAND' | 'STORE_PICKUP';
  payment_method: 'CASH_ON_DELIVERY' | 'CASH_ON_PICKUP' | 'BANK_TRANSFER' | 'ONLINE_GATEWAY';
  payment_status: Generated<'UNPAID' | 'AUTHORIZED' | 'PAID' | 'FAILED' | 'REFUNDED' | 'CANCELLED'>;
  currency: Generated<string>;
  locale: Generated<'FR' | 'EN' | 'AR'>;
  subtotal: string;
  discount_total: Generated<string>;
  shipping_total: Generated<string>;
  grand_total: string;
  email: string;
  phone: string;
  first_name: string;
  last_name: string;
  address_line1: Generated<string | null>;
  address_line2: Generated<string | null>;
  city: Generated<string | null>;
  governorate: Generated<string | null>;
  postal_code: Generated<string | null>;
  country: Generated<string>;
  pickup_point_id: Generated<string | null>;
  pickup_point_name: Generated<string | null>;
  customer_note: Generated<string | null>;
  internal_note: Generated<string | null>;
  discount_code: Generated<string | null>;
  placed_at: ColumnType<Date, Date | string | undefined, Date | string>;
  confirmed_at: ColumnType<Date | null, Date | string | null | undefined, Date | string | null>;
  completed_at: ColumnType<Date | null, Date | string | null | undefined, Date | string | null>;
  cancelled_at: ColumnType<Date | null, Date | string | null | undefined, Date | string | null>;
  cancel_reason: Generated<string | null>;
  updated_at: ColumnType<Date, Date | string | undefined, Date | string>;
}
export type Order = Selectable<OrdersTable>;
export type NewOrder = Insertable<OrdersTable>;
export type OrderUpdate = Updateable<OrdersTable>;

export interface PaymentsTable {
  id: string;
  order_id: string;
  method: 'CASH_ON_DELIVERY' | 'CASH_ON_PICKUP' | 'BANK_TRANSFER' | 'ONLINE_GATEWAY';
  status: Generated<'UNPAID' | 'AUTHORIZED' | 'PAID' | 'FAILED' | 'REFUNDED' | 'CANCELLED'>;
  amount: string;
  currency: Generated<string>;
  provider: string;
  provider_ref: Generated<string | null>;
  failure_reason: Generated<string | null>;
  paid_at: ColumnType<Date | null, Date | string | null | undefined, Date | string | null>;
  created_at: ColumnType<Date, Date | string | undefined, Date | string>;
  updated_at: ColumnType<Date, Date | string | undefined, Date | string>;
}
export type Payment = Selectable<PaymentsTable>;
export type NewPayment = Insertable<PaymentsTable>;
export type PaymentUpdate = Updateable<PaymentsTable>;

export interface PermissionsTable {
  id: Generated<number>;
  key: string;
  label: string;
}
export type Permission = Selectable<PermissionsTable>;
export type NewPermission = Insertable<PermissionsTable>;
export type PermissionUpdate = Updateable<PermissionsTable>;

export interface PickupPointTranslationsTable {
  id: string;
  point_id: string;
  locale: 'FR' | 'EN' | 'AR';
  name: string;
  hours: Generated<string | null>;
}
export type PickupPointTranslation = Selectable<PickupPointTranslationsTable>;
export type NewPickupPointTranslation = Insertable<PickupPointTranslationsTable>;
export type PickupPointTranslationUpdate = Updateable<PickupPointTranslationsTable>;

export interface PickupPointsTable {
  id: string;
  slug: string;
  is_active: Generated<boolean>;
  address_line: string;
  city: string;
  governorate: string;
  phone: Generated<string | null>;
  map_url: Generated<string | null>;
  position: Generated<number>;
}
export type PickupPoint = Selectable<PickupPointsTable>;
export type NewPickupPoint = Insertable<PickupPointsTable>;
export type PickupPointUpdate = Updateable<PickupPointsTable>;

export interface ProductMediaTable {
  id: string;
  product_id: string;
  kind: Generated<'IMAGE' | 'VIDEO'>;
  path: string;
  alt: Generated<string | null>;
  width: Generated<number | null>;
  height: Generated<number | null>;
  position: Generated<number>;
  created_at: ColumnType<Date, Date | string | undefined, Date | string>;
}
export type ProductMedia = Selectable<ProductMediaTable>;
export type NewProductMedia = Insertable<ProductMediaTable>;
export type ProductMediaUpdate = Updateable<ProductMediaTable>;

export interface ProductNeedsTable {
  product_id: string;
  need_id: string;
}
export type ProductNeed = Selectable<ProductNeedsTable>;
export type NewProductNeed = Insertable<ProductNeedsTable>;
export type ProductNeedUpdate = Updateable<ProductNeedsTable>;

export interface ProductRelationsTable {
  id: string;
  source_id: string;
  target_id: string;
  kind: Generated<'COMPLEMENTARY' | 'SIMILAR'>;
  position: Generated<number>;
}
export type ProductRelation = Selectable<ProductRelationsTable>;
export type NewProductRelation = Insertable<ProductRelationsTable>;
export type ProductRelationUpdate = Updateable<ProductRelationsTable>;

export interface ProductTranslationsTable {
  id: string;
  product_id: string;
  locale: 'FR' | 'EN' | 'AR';
  name: string;
  tagline: Generated<string | null>;
  description: Generated<string | null>;
  usage_notes: Generated<string | null>;
  composition: Generated<string | null>;
  precautions: Generated<string | null>;
  storage: Generated<string | null>;
  meta_title: Generated<string | null>;
  meta_description: Generated<string | null>;
}
export type ProductTranslation = Selectable<ProductTranslationsTable>;
export type NewProductTranslation = Insertable<ProductTranslationsTable>;
export type ProductTranslationUpdate = Updateable<ProductTranslationsTable>;

export interface ProductVariantsTable {
  id: string;
  product_id: string;
  sku: string;
  format: string;
  price: string;
  compare_at_price: Generated<string | null>;
  stock: Generated<number>;
  low_stock_at: Generated<number>;
  allow_backorder: Generated<boolean>;
  weight_grams: Generated<number | null>;
  position: Generated<number>;
  is_active: Generated<boolean>;
  created_at: ColumnType<Date, Date | string | undefined, Date | string>;
  updated_at: ColumnType<Date, Date | string | undefined, Date | string>;
}
export type ProductVariant = Selectable<ProductVariantsTable>;
export type NewProductVariant = Insertable<ProductVariantsTable>;
export type ProductVariantUpdate = Updateable<ProductVariantsTable>;

export interface ProductsTable {
  id: string;
  slug: string;
  reference: Generated<string | null>;
  category_id: Generated<string | null>;
  state: Generated<'DRAFT' | 'PUBLISHED' | 'ARCHIVED'>;
  is_featured: Generated<boolean>;
  is_professional: Generated<boolean>;
  position: Generated<number>;
  published_at: ColumnType<Date | null, Date | string | null | undefined, Date | string | null>;
  created_at: ColumnType<Date, Date | string | undefined, Date | string>;
  updated_at: ColumnType<Date, Date | string | undefined, Date | string>;
  deleted_at: ColumnType<Date | null, Date | string | null | undefined, Date | string | null>;
}
export type Product = Selectable<ProductsTable>;
export type NewProduct = Insertable<ProductsTable>;
export type ProductUpdate = Updateable<ProductsTable>;

export interface ReferenceCountersTable {
  scope: string;
  period: string;
  next_value: Generated<number>;
}
export type ReferenceCounter = Selectable<ReferenceCountersTable>;
export type NewReferenceCounter = Insertable<ReferenceCountersTable>;
export type ReferenceCounterUpdate = Updateable<ReferenceCountersTable>;

export interface ReservationSeatsTable {
  id: string;
  slot_id: string;
  seat_index: number;
  reservation_id: string;
  created_at: ColumnType<Date, Date | string | undefined, Date | string>;
}
export type ReservationSeat = Selectable<ReservationSeatsTable>;
export type NewReservationSeat = Insertable<ReservationSeatsTable>;
export type ReservationSeatUpdate = Updateable<ReservationSeatsTable>;

export interface ReservationsTable {
  id: string;
  reference: string;
  service_id: string;
  slot_id: string;
  customer_id: Generated<string | null>;
  status: Generated<'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW'>;
  service_name: string;
  starts_at: ColumnType<Date, Date | string, Date | string>;
  ends_at: ColumnType<Date, Date | string, Date | string>;
  price_at_booking: Generated<string | null>;
  location_name: Generated<string | null>;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  note: Generated<string | null>;
  internal_note: Generated<string | null>;
  locale: Generated<'FR' | 'EN' | 'AR'>;
  created_at: ColumnType<Date, Date | string | undefined, Date | string>;
  updated_at: ColumnType<Date, Date | string | undefined, Date | string>;
  confirmed_at: ColumnType<Date | null, Date | string | null | undefined, Date | string | null>;
  cancelled_at: ColumnType<Date | null, Date | string | null | undefined, Date | string | null>;
  cancel_reason: Generated<string | null>;
}
export type Reservation = Selectable<ReservationsTable>;
export type NewReservation = Insertable<ReservationsTable>;
export type ReservationUpdate = Updateable<ReservationsTable>;

export interface ReviewsTable {
  id: string;
  product_id: string;
  customer_id: Generated<string | null>;
  author_name: string;
  rating: number;
  body: Generated<string | null>;
  is_approved: Generated<boolean>;
  created_at: ColumnType<Date, Date | string | undefined, Date | string>;
}
export type Review = Selectable<ReviewsTable>;
export type NewReview = Insertable<ReviewsTable>;
export type ReviewUpdate = Updateable<ReviewsTable>;

export interface RitualStepTranslationsTable {
  id: string;
  step_id: string;
  locale: 'FR' | 'EN' | 'AR';
  title: string;
  body: Generated<string | null>;
}
export type RitualStepTranslation = Selectable<RitualStepTranslationsTable>;
export type NewRitualStepTranslation = Insertable<RitualStepTranslationsTable>;
export type RitualStepTranslationUpdate = Updateable<RitualStepTranslationsTable>;

export interface RitualStepsTable {
  id: string;
  ritual_id: string;
  product_id: Generated<string | null>;
  position: Generated<number>;
}
export type RitualStep = Selectable<RitualStepsTable>;
export type NewRitualStep = Insertable<RitualStepsTable>;
export type RitualStepUpdate = Updateable<RitualStepsTable>;

export interface RitualTranslationsTable {
  id: string;
  ritual_id: string;
  locale: 'FR' | 'EN' | 'AR';
  name: string;
  intro: Generated<string | null>;
}
export type RitualTranslation = Selectable<RitualTranslationsTable>;
export type NewRitualTranslation = Insertable<RitualTranslationsTable>;
export type RitualTranslationUpdate = Updateable<RitualTranslationsTable>;

export interface RitualsTable {
  id: string;
  slug: string;
  state: Generated<'DRAFT' | 'PUBLISHED' | 'ARCHIVED'>;
  position: Generated<number>;
  cover_path: Generated<string | null>;
  created_at: ColumnType<Date, Date | string | undefined, Date | string>;
  updated_at: ColumnType<Date, Date | string | undefined, Date | string>;
}
export type Ritual = Selectable<RitualsTable>;
export type NewRitual = Insertable<RitualsTable>;
export type RitualUpdate = Updateable<RitualsTable>;

export interface RolePermissionsTable {
  role_id: number;
  permission_id: number;
}
export type RolePermission = Selectable<RolePermissionsTable>;
export type NewRolePermission = Insertable<RolePermissionsTable>;
export type RolePermissionUpdate = Updateable<RolePermissionsTable>;

export interface RolesTable {
  id: Generated<number>;
  key: string;
  label: string;
  is_system: Generated<boolean>;
  created_at: ColumnType<Date, Date | string | undefined, Date | string>;
  updated_at: ColumnType<Date, Date | string | undefined, Date | string>;
}
export type Role = Selectable<RolesTable>;
export type NewRole = Insertable<RolesTable>;
export type RoleUpdate = Updateable<RolesTable>;

export interface ServiceTranslationsTable {
  id: string;
  service_id: string;
  locale: 'FR' | 'EN' | 'AR';
  name: string;
  tagline: Generated<string | null>;
  description: Generated<string | null>;
  preparation: Generated<string | null>;
  meta_title: Generated<string | null>;
  meta_description: Generated<string | null>;
}
export type ServiceTranslation = Selectable<ServiceTranslationsTable>;
export type NewServiceTranslation = Insertable<ServiceTranslationsTable>;
export type ServiceTranslationUpdate = Updateable<ServiceTranslationsTable>;

export interface ServicesTable {
  id: string;
  slug: string;
  state: Generated<'DRAFT' | 'PUBLISHED' | 'ARCHIVED'>;
  duration_min: Generated<number>;
  capacity: Generated<number>;
  price: Generated<string | null>;
  deposit_amount: Generated<string | null>;
  buffer_min: Generated<number>;
  lead_time_hours: Generated<number>;
  horizon_days: Generated<number>;
  cover_path: Generated<string | null>;
  location_id: Generated<string | null>;
  position: Generated<number>;
  created_at: ColumnType<Date, Date | string | undefined, Date | string>;
  updated_at: ColumnType<Date, Date | string | undefined, Date | string>;
  deleted_at: ColumnType<Date | null, Date | string | null | undefined, Date | string | null>;
}
export type Service = Selectable<ServicesTable>;
export type NewService = Insertable<ServicesTable>;
export type ServiceUpdate = Updateable<ServicesTable>;

export interface SettingsTable {
  key: string;
  value: unknown;
  updated_at: ColumnType<Date, Date | string | undefined, Date | string>;
}
export type Setting = Selectable<SettingsTable>;
export type NewSetting = Insertable<SettingsTable>;
export type SettingUpdate = Updateable<SettingsTable>;

export interface ShippingZonesTable {
  id: string;
  name: string;
  governorates: unknown;
  price: string;
  free_above: Generated<string | null>;
  eta_days: Generated<string | null>;
  is_active: Generated<boolean>;
  position: Generated<number>;
}
export type ShippingZone = Selectable<ShippingZonesTable>;
export type NewShippingZone = Insertable<ShippingZonesTable>;
export type ShippingZoneUpdate = Updateable<ShippingZonesTable>;

export interface SlotsTable {
  id: string;
  service_id: string;
  starts_at: ColumnType<Date, Date | string, Date | string>;
  ends_at: ColumnType<Date, Date | string, Date | string>;
  capacity: Generated<number>;
  is_blocked: Generated<boolean>;
  created_at: ColumnType<Date, Date | string | undefined, Date | string>;
}
export type Slot = Selectable<SlotsTable>;
export type NewSlot = Insertable<SlotsTable>;
export type SlotUpdate = Updateable<SlotsTable>;

export interface StockMovementsTable {
  id: Generated<string>;
  variant_id: string;
  delta: number;
  reason: 'MANUAL_ADJUSTMENT' | 'ORDER_RESERVED' | 'ORDER_RELEASED' | 'ORDER_FULFILLED' | 'RESTOCK';
  reference: Generated<string | null>;
  admin_id: Generated<string | null>;
  created_at: ColumnType<Date, Date | string | undefined, Date | string>;
}
export type StockMovement = Selectable<StockMovementsTable>;
export type NewStockMovement = Insertable<StockMovementsTable>;
export type StockMovementUpdate = Updateable<StockMovementsTable>;

export interface WebhookEventsTable {
  id: string;
  provider: string;
  external_id: string;
  payload: unknown;
  processed_at: ColumnType<Date | null, Date | string | null | undefined, Date | string | null>;
  created_at: ColumnType<Date, Date | string | undefined, Date | string>;
}
export type WebhookEvent = Selectable<WebhookEventsTable>;
export type NewWebhookEvent = Insertable<WebhookEventsTable>;
export type WebhookEventUpdate = Updateable<WebhookEventsTable>;

export interface Database {
  addresses: AddressesTable;
  admin_sessions: AdminSessionsTable;
  admin_users: AdminUsersTable;
  announcement_translations: AnnouncementTranslationsTable;
  announcements: AnnouncementsTable;
  audit_logs: AuditLogsTable;
  availability_exceptions: AvailabilityExceptionsTable;
  availability_rules: AvailabilityRulesTable;
  cart_items: CartItemsTable;
  carts: CartsTable;
  categories: CategoriesTable;
  category_translations: CategoryTranslationsTable;
  collection_products: CollectionProductsTable;
  collection_translations: CollectionTranslationsTable;
  collections: CollectionsTable;
  content_block_translations: ContentBlockTranslationsTable;
  content_blocks: ContentBlocksTable;
  customer_sessions: CustomerSessionsTable;
  customers: CustomersTable;
  discounts: DiscountsTable;
  idempotency_keys: IdempotencyKeysTable;
  inquiries: InquiriesTable;
  need_translations: NeedTranslationsTable;
  needs: NeedsTable;
  order_events: OrderEventsTable;
  order_lines: OrderLinesTable;
  orders: OrdersTable;
  payments: PaymentsTable;
  permissions: PermissionsTable;
  pickup_point_translations: PickupPointTranslationsTable;
  pickup_points: PickupPointsTable;
  product_media: ProductMediaTable;
  product_needs: ProductNeedsTable;
  product_relations: ProductRelationsTable;
  product_translations: ProductTranslationsTable;
  product_variants: ProductVariantsTable;
  products: ProductsTable;
  reference_counters: ReferenceCountersTable;
  reservation_seats: ReservationSeatsTable;
  reservations: ReservationsTable;
  reviews: ReviewsTable;
  ritual_step_translations: RitualStepTranslationsTable;
  ritual_steps: RitualStepsTable;
  ritual_translations: RitualTranslationsTable;
  rituals: RitualsTable;
  role_permissions: RolePermissionsTable;
  roles: RolesTable;
  service_translations: ServiceTranslationsTable;
  services: ServicesTable;
  settings: SettingsTable;
  shipping_zones: ShippingZonesTable;
  slots: SlotsTable;
  stock_movements: StockMovementsTable;
  webhook_events: WebhookEventsTable;
  schema_migrations: { name: string; applied_at: Generated<Timestamp> };
}
