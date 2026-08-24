-- BOA Cosmetic — initial schema
-- Targets MySQL 8.0 and MariaDB 10.6+ (Hostinger ships MariaDB on most plans).
-- Collation is utf8mb4_unicode_ci rather than utf8mb4_0900_ai_ci so the same
-- DDL runs on both engines.
--
-- Money is DECIMAL(10,3): the Tunisian dinar is millime-denominated, so cents
-- would lose a decimal place on every price.
--
-- Historical integrity: orders and reservations snapshot the data they display.
-- Renaming, repricing, unpublishing or archiving a product can never rewrite a
-- record of something that already happened.

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 1;

-- ────────────────────────────────────────────────────────── identity & access

CREATE TABLE roles (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `key`         VARCHAR(64)  NOT NULL,
  label         VARCHAR(120) NOT NULL,
  is_system     TINYINT(1)   NOT NULL DEFAULT 0,
  created_at    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_roles_key (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE permissions (
  id     INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `key`  VARCHAR(64)  NOT NULL,
  label  VARCHAR(160) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_permissions_key (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE role_permissions (
  role_id       INT UNSIGNED NOT NULL,
  permission_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (role_id, permission_id),
  KEY idx_role_permissions_permission (permission_id),
  CONSTRAINT fk_role_permissions_role FOREIGN KEY (role_id) REFERENCES roles (id) ON DELETE CASCADE,
  CONSTRAINT fk_role_permissions_permission FOREIGN KEY (permission_id) REFERENCES permissions (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE admin_users (
  id            CHAR(24)     NOT NULL,
  email         VARCHAR(190) NOT NULL,
  password_hash VARCHAR(120) NOT NULL,
  name          VARCHAR(120) NOT NULL,
  status        ENUM('ACTIVE','SUSPENDED') NOT NULL DEFAULT 'ACTIVE',
  role_id       INT UNSIGNED NOT NULL,
  last_login_at DATETIME(3)  NULL,
  failed_logins INT          NOT NULL DEFAULT 0,
  locked_until  DATETIME(3)  NULL,
  created_at    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_admin_users_email (email),
  KEY idx_admin_users_role (role_id),
  CONSTRAINT fk_admin_users_role FOREIGN KEY (role_id) REFERENCES roles (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- The cookie carries an opaque random token; only its SHA-256 is stored, so a
-- database dump does not hand an attacker live sessions.
CREATE TABLE admin_sessions (
  id         CHAR(24)    NOT NULL,
  token_hash CHAR(64)    NOT NULL,
  admin_id   CHAR(24)    NOT NULL,
  ip         VARCHAR(64) NULL,
  user_agent VARCHAR(255) NULL,
  expires_at DATETIME(3) NOT NULL,
  revoked_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_admin_sessions_token (token_hash),
  KEY idx_admin_sessions_admin (admin_id),
  KEY idx_admin_sessions_expiry (expires_at),
  CONSTRAINT fk_admin_sessions_admin FOREIGN KEY (admin_id) REFERENCES admin_users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE audit_logs (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  admin_id   CHAR(24)    NULL,
  action     VARCHAR(80) NOT NULL,
  entity     VARCHAR(60) NOT NULL,
  entity_id  VARCHAR(64) NOT NULL,
  summary    VARCHAR(255) NULL,
  diff       JSON        NULL,
  ip         VARCHAR(64) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_audit_entity (entity, entity_id),
  KEY idx_audit_created (created_at),
  KEY idx_audit_admin (admin_id),
  CONSTRAINT fk_audit_admin FOREIGN KEY (admin_id) REFERENCES admin_users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────────────────── customers

CREATE TABLE customers (
  id             CHAR(24)     NOT NULL,
  email          VARCHAR(190) NOT NULL,
  password_hash  VARCHAR(120) NULL,          -- NULL = record created by a guest checkout
  first_name     VARCHAR(80)  NULL,
  last_name      VARCHAR(80)  NULL,
  phone          VARCHAR(40)  NULL,
  locale         ENUM('FR','EN','AR') NOT NULL DEFAULT 'FR',
  accepts_marketing TINYINT(1) NOT NULL DEFAULT 0,
  email_verified_at DATETIME(3) NULL,
  failed_logins  INT          NOT NULL DEFAULT 0,
  locked_until   DATETIME(3)  NULL,
  created_at     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at     DATETIME(3)  NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_customers_email (email),
  KEY idx_customers_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE customer_sessions (
  id          CHAR(24)    NOT NULL,
  token_hash  CHAR(64)    NOT NULL,
  customer_id CHAR(24)    NOT NULL,
  expires_at  DATETIME(3) NOT NULL,
  revoked_at  DATETIME(3) NULL,
  created_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_customer_sessions_token (token_hash),
  KEY idx_customer_sessions_customer (customer_id),
  KEY idx_customer_sessions_expiry (expires_at),
  CONSTRAINT fk_customer_sessions_customer FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE addresses (
  id          CHAR(24)     NOT NULL,
  customer_id CHAR(24)     NOT NULL,
  label       VARCHAR(60)  NULL,
  first_name  VARCHAR(80)  NOT NULL,
  last_name   VARCHAR(80)  NOT NULL,
  phone       VARCHAR(40)  NOT NULL,
  line1       VARCHAR(190) NOT NULL,
  line2       VARCHAR(190) NULL,
  city        VARCHAR(90)  NOT NULL,
  governorate VARCHAR(90)  NOT NULL,
  postal_code VARCHAR(20)  NULL,
  country     CHAR(2)      NOT NULL DEFAULT 'TN',
  is_default  TINYINT(1)   NOT NULL DEFAULT 0,
  created_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at  DATETIME(3)  NULL,
  PRIMARY KEY (id),
  KEY idx_addresses_customer (customer_id, deleted_at),
  CONSTRAINT fk_addresses_customer FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ───────────────────────────────────────────────────────────────────── catalog

CREATE TABLE categories (
  id         CHAR(24)     NOT NULL,
  slug       VARCHAR(120) NOT NULL,
  parent_id  CHAR(24)     NULL,
  position   INT          NOT NULL DEFAULT 0,
  state      ENUM('DRAFT','PUBLISHED','ARCHIVED') NOT NULL DEFAULT 'DRAFT',
  image_path VARCHAR(255) NULL,
  created_at DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_categories_slug (slug),
  KEY idx_categories_parent (parent_id),
  KEY idx_categories_listing (state, position),
  CONSTRAINT fk_categories_parent FOREIGN KEY (parent_id) REFERENCES categories (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE category_translations (
  id               CHAR(24)     NOT NULL,
  category_id      CHAR(24)     NOT NULL,
  locale           ENUM('FR','EN','AR') NOT NULL,
  name             VARCHAR(160) NOT NULL,
  intro            TEXT         NULL,
  meta_title       VARCHAR(190) NULL,
  meta_description VARCHAR(320) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_category_translations (category_id, locale),
  CONSTRAINT fk_category_translations_category FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- A need-state facet ("réparation", "lissage"). Data, not a code enum, because
-- BOA's vocabulary will move faster than the codebase.
CREATE TABLE needs (
  id       CHAR(24)     NOT NULL,
  slug     VARCHAR(120) NOT NULL,
  position INT          NOT NULL DEFAULT 0,
  state    ENUM('DRAFT','PUBLISHED','ARCHIVED') NOT NULL DEFAULT 'DRAFT',
  PRIMARY KEY (id),
  UNIQUE KEY uq_needs_slug (slug),
  KEY idx_needs_listing (state, position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE need_translations (
  id      CHAR(24)     NOT NULL,
  need_id CHAR(24)     NOT NULL,
  locale  ENUM('FR','EN','AR') NOT NULL,
  name    VARCHAR(120) NOT NULL,
  tagline VARCHAR(255) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_need_translations (need_id, locale),
  CONSTRAINT fk_need_translations_need FOREIGN KEY (need_id) REFERENCES needs (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE products (
  id              CHAR(24)     NOT NULL,
  slug            VARCHAR(160) NOT NULL,
  reference       VARCHAR(60)  NULL,
  category_id     CHAR(24)     NULL,
  state           ENUM('DRAFT','PUBLISHED','ARCHIVED') NOT NULL DEFAULT 'DRAFT',
  is_featured     TINYINT(1)   NOT NULL DEFAULT 0,
  is_professional TINYINT(1)   NOT NULL DEFAULT 0,
  position        INT          NOT NULL DEFAULT 0,
  published_at    DATETIME(3)  NULL,
  created_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at      DATETIME(3)  NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_products_slug (slug),
  UNIQUE KEY uq_products_reference (reference),
  KEY idx_products_listing (state, deleted_at, position),
  KEY idx_products_featured (state, is_featured, position),
  KEY idx_products_category (category_id, state, deleted_at),
  CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Every long field is nullable on purpose: an empty section is omitted from the
-- product page rather than filled with invented copy.
CREATE TABLE product_translations (
  id               CHAR(24)     NOT NULL,
  product_id       CHAR(24)     NOT NULL,
  locale           ENUM('FR','EN','AR') NOT NULL,
  name             VARCHAR(190) NOT NULL,
  tagline          VARCHAR(255) NULL,
  description      TEXT         NULL,
  usage_notes      TEXT         NULL,
  composition      TEXT         NULL,
  precautions      TEXT         NULL,
  storage          TEXT         NULL,
  meta_title       VARCHAR(190) NULL,
  meta_description VARCHAR(320) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_product_translations (product_id, locale),
  FULLTEXT KEY ft_product_translations (name, tagline, description),
  CONSTRAINT fk_product_translations_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE product_needs (
  product_id CHAR(24) NOT NULL,
  need_id    CHAR(24) NOT NULL,
  PRIMARY KEY (product_id, need_id),
  KEY idx_product_needs_need (need_id),
  CONSTRAINT fk_product_needs_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE,
  CONSTRAINT fk_product_needs_need FOREIGN KEY (need_id) REFERENCES needs (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE product_relations (
  id        CHAR(24) NOT NULL,
  source_id CHAR(24) NOT NULL,
  target_id CHAR(24) NOT NULL,
  kind      ENUM('COMPLEMENTARY','SIMILAR') NOT NULL DEFAULT 'COMPLEMENTARY',
  position  INT      NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uq_product_relations (source_id, target_id, kind),
  KEY idx_product_relations_target (target_id),
  CONSTRAINT fk_product_relations_source FOREIGN KEY (source_id) REFERENCES products (id) ON DELETE CASCADE,
  CONSTRAINT fk_product_relations_target FOREIGN KEY (target_id) REFERENCES products (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- One buyable unit: a format (100 ml / 250 ml / 1 L). Price and stock live here,
-- never on the product, so a product with two formats cannot have one price.
CREATE TABLE product_variants (
  id               CHAR(24)      NOT NULL,
  product_id       CHAR(24)      NOT NULL,
  sku              VARCHAR(60)   NOT NULL,
  format           VARCHAR(60)   NOT NULL,
  price            DECIMAL(10,3) NOT NULL,
  compare_at_price DECIMAL(10,3) NULL,
  stock            INT           NOT NULL DEFAULT 0,
  low_stock_at     INT           NOT NULL DEFAULT 5,
  allow_backorder  TINYINT(1)    NOT NULL DEFAULT 0,
  weight_grams     INT           NULL,
  position         INT           NOT NULL DEFAULT 0,
  is_active        TINYINT(1)    NOT NULL DEFAULT 1,
  created_at       DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at       DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_product_variants_sku (sku),
  KEY idx_product_variants_product (product_id, position),
  KEY idx_product_variants_stock (stock),
  CONSTRAINT fk_product_variants_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE,
  CONSTRAINT ck_product_variants_price CHECK (price >= 0),
  CONSTRAINT ck_product_variants_stock CHECK (stock >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE stock_movements (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  variant_id CHAR(24)    NOT NULL,
  delta      INT         NOT NULL,
  reason     ENUM('MANUAL_ADJUSTMENT','ORDER_RESERVED','ORDER_RELEASED','ORDER_FULFILLED','RESTOCK') NOT NULL,
  reference  VARCHAR(64) NULL,
  admin_id   CHAR(24)    NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_stock_movements_variant (variant_id, created_at),
  CONSTRAINT fk_stock_movements_variant FOREIGN KEY (variant_id) REFERENCES product_variants (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- `path` is relative to the configured storage driver, never an absolute URL,
-- so moving from local disk to object storage is a config change plus a copy.
CREATE TABLE product_media (
  id         CHAR(24)     NOT NULL,
  product_id CHAR(24)     NOT NULL,
  kind       ENUM('IMAGE','VIDEO') NOT NULL DEFAULT 'IMAGE',
  path       VARCHAR(255) NOT NULL,
  alt        VARCHAR(255) NULL,
  width      INT          NULL,
  height     INT          NULL,
  position   INT          NOT NULL DEFAULT 0,
  created_at DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_product_media_product (product_id, position),
  CONSTRAINT fk_product_media_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE collections (
  id         CHAR(24)     NOT NULL,
  slug       VARCHAR(120) NOT NULL,
  state      ENUM('DRAFT','PUBLISHED','ARCHIVED') NOT NULL DEFAULT 'DRAFT',
  position   INT          NOT NULL DEFAULT 0,
  cover_path VARCHAR(255) NULL,
  created_at DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_collections_slug (slug),
  KEY idx_collections_listing (state, position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE collection_translations (
  id               CHAR(24)     NOT NULL,
  collection_id    CHAR(24)     NOT NULL,
  locale           ENUM('FR','EN','AR') NOT NULL,
  name             VARCHAR(160) NOT NULL,
  intro            TEXT         NULL,
  meta_title       VARCHAR(190) NULL,
  meta_description VARCHAR(320) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_collection_translations (collection_id, locale),
  CONSTRAINT fk_collection_translations_collection FOREIGN KEY (collection_id) REFERENCES collections (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE collection_products (
  collection_id CHAR(24) NOT NULL,
  product_id    CHAR(24) NOT NULL,
  position      INT      NOT NULL DEFAULT 0,
  PRIMARY KEY (collection_id, product_id),
  KEY idx_collection_products_product (product_id),
  CONSTRAINT fk_collection_products_collection FOREIGN KEY (collection_id) REFERENCES collections (id) ON DELETE CASCADE,
  CONSTRAINT fk_collection_products_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- A ritual is an ordered regimen of real products — BOA's differentiator over a
-- shop that only lists bottles.
CREATE TABLE rituals (
  id         CHAR(24)     NOT NULL,
  slug       VARCHAR(120) NOT NULL,
  state      ENUM('DRAFT','PUBLISHED','ARCHIVED') NOT NULL DEFAULT 'DRAFT',
  position   INT          NOT NULL DEFAULT 0,
  cover_path VARCHAR(255) NULL,
  created_at DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_rituals_slug (slug),
  KEY idx_rituals_listing (state, position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ritual_translations (
  id        CHAR(24)     NOT NULL,
  ritual_id CHAR(24)     NOT NULL,
  locale    ENUM('FR','EN','AR') NOT NULL,
  name      VARCHAR(160) NOT NULL,
  intro     TEXT         NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ritual_translations (ritual_id, locale),
  CONSTRAINT fk_ritual_translations_ritual FOREIGN KEY (ritual_id) REFERENCES rituals (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ritual_steps (
  id         CHAR(24) NOT NULL,
  ritual_id  CHAR(24) NOT NULL,
  product_id CHAR(24) NULL,
  position   INT      NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_ritual_steps_ritual (ritual_id, position),
  KEY idx_ritual_steps_product (product_id),
  CONSTRAINT fk_ritual_steps_ritual FOREIGN KEY (ritual_id) REFERENCES rituals (id) ON DELETE CASCADE,
  CONSTRAINT fk_ritual_steps_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ritual_step_translations (
  id      CHAR(24)     NOT NULL,
  step_id CHAR(24)     NOT NULL,
  locale  ENUM('FR','EN','AR') NOT NULL,
  title   VARCHAR(160) NOT NULL,
  body    TEXT         NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ritual_step_translations (step_id, locale),
  CONSTRAINT fk_ritual_step_translations_step FOREIGN KEY (step_id) REFERENCES ritual_steps (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Reviews render only when they exist and are approved. None are seeded.
CREATE TABLE reviews (
  id          CHAR(24)     NOT NULL,
  product_id  CHAR(24)     NOT NULL,
  customer_id CHAR(24)     NULL,
  author_name VARCHAR(120) NOT NULL,
  rating      TINYINT      NOT NULL,
  body        TEXT         NULL,
  is_approved TINYINT(1)   NOT NULL DEFAULT 0,
  created_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_reviews_product (product_id, is_approved),
  CONSTRAINT fk_reviews_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE,
  CONSTRAINT fk_reviews_customer FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE SET NULL,
  CONSTRAINT ck_reviews_rating CHECK (rating BETWEEN 1 AND 5)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────────── pickup & shipping

CREATE TABLE pickup_points (
  id           CHAR(24)     NOT NULL,
  slug         VARCHAR(80)  NOT NULL,
  is_active    TINYINT(1)   NOT NULL DEFAULT 1,
  address_line VARCHAR(190) NOT NULL,
  city         VARCHAR(90)  NOT NULL,
  governorate  VARCHAR(90)  NOT NULL,
  phone        VARCHAR(40)  NULL,
  map_url      VARCHAR(255) NULL,
  position     INT          NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uq_pickup_points_slug (slug),
  KEY idx_pickup_points_listing (is_active, position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE pickup_point_translations (
  id       CHAR(24)     NOT NULL,
  point_id CHAR(24)     NOT NULL,
  locale   ENUM('FR','EN','AR') NOT NULL,
  name     VARCHAR(160) NOT NULL,
  hours    VARCHAR(255) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_pickup_point_translations (point_id, locale),
  CONSTRAINT fk_pickup_point_translations_point FOREIGN KEY (point_id) REFERENCES pickup_points (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Delivery pricing by governorate. A governorate with no zone simply has no
-- delivery option, which is honest rather than guessed.
CREATE TABLE shipping_zones (
  id           CHAR(24)      NOT NULL,
  name         VARCHAR(120)  NOT NULL,
  governorates JSON          NOT NULL,
  price        DECIMAL(10,3) NOT NULL,
  free_above   DECIMAL(10,3) NULL,
  eta_days     VARCHAR(40)   NULL,
  is_active    TINYINT(1)    NOT NULL DEFAULT 1,
  position     INT           NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_shipping_zones_listing (is_active, position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE discounts (
  id                 CHAR(24)      NOT NULL,
  code               VARCHAR(40)   NOT NULL,
  kind               ENUM('PERCENTAGE','FIXED_AMOUNT','FREE_SHIPPING') NOT NULL,
  value              DECIMAL(10,3) NOT NULL DEFAULT 0,
  min_subtotal       DECIMAL(10,3) NULL,
  max_redemptions    INT           NULL,
  redemptions        INT           NOT NULL DEFAULT 0,
  per_customer_limit INT           NULL,
  starts_at          DATETIME(3)   NULL,
  ends_at            DATETIME(3)   NULL,
  is_active          TINYINT(1)    NOT NULL DEFAULT 1,
  created_at         DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at         DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_discounts_code (code),
  KEY idx_discounts_window (is_active, starts_at, ends_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ──────────────────────────────────────────────────────────────────────── cart

-- The browser holds an opaque cart token only. Prices are never sent by the
-- client, so there is nothing for a client to tamper with.
CREATE TABLE carts (
  id           CHAR(24)    NOT NULL,
  token        CHAR(48)    NOT NULL,
  customer_id  CHAR(24)    NULL,
  currency     CHAR(3)     NOT NULL DEFAULT 'TND',
  created_at   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  expires_at   DATETIME(3) NOT NULL,
  converted_at DATETIME(3) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_carts_token (token),
  KEY idx_carts_customer (customer_id),
  KEY idx_carts_expiry (expires_at),
  CONSTRAINT fk_carts_customer FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE cart_items (
  id         CHAR(24)    NOT NULL,
  cart_id    CHAR(24)    NOT NULL,
  variant_id CHAR(24)    NOT NULL,
  quantity   INT         NOT NULL,
  added_at   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_cart_items (cart_id, variant_id),
  KEY idx_cart_items_variant (variant_id),
  CONSTRAINT fk_cart_items_cart FOREIGN KEY (cart_id) REFERENCES carts (id) ON DELETE CASCADE,
  CONSTRAINT fk_cart_items_variant FOREIGN KEY (variant_id) REFERENCES product_variants (id) ON DELETE CASCADE,
  CONSTRAINT ck_cart_items_quantity CHECK (quantity > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ────────────────────────────────────────────────────────────────────── orders

CREATE TABLE orders (
  id             CHAR(24)      NOT NULL,
  reference      VARCHAR(24)   NOT NULL,
  customer_id    CHAR(24)      NULL,
  status         ENUM('PENDING','CONFIRMED','PREPARING','SHIPPED','READY_FOR_PICKUP','COMPLETED','CANCELLED','REFUNDED') NOT NULL DEFAULT 'PENDING',
  fulfilment     ENUM('DELIVERY','HAND_TO_HAND','STORE_PICKUP') NOT NULL,
  payment_method ENUM('CASH_ON_DELIVERY','CASH_ON_PICKUP','BANK_TRANSFER','ONLINE_GATEWAY') NOT NULL,
  payment_status ENUM('UNPAID','AUTHORIZED','PAID','FAILED','REFUNDED','CANCELLED') NOT NULL DEFAULT 'UNPAID',
  currency       CHAR(3)       NOT NULL DEFAULT 'TND',
  locale         ENUM('FR','EN','AR') NOT NULL DEFAULT 'FR',

  subtotal       DECIMAL(10,3) NOT NULL,
  discount_total DECIMAL(10,3) NOT NULL DEFAULT 0,
  shipping_total DECIMAL(10,3) NOT NULL DEFAULT 0,
  grand_total    DECIMAL(10,3) NOT NULL,

  -- Contact and address are snapshotted, never joined: the order stays readable
  -- if the customer edits or deletes their address book.
  email          VARCHAR(190)  NOT NULL,
  phone          VARCHAR(40)   NOT NULL,
  first_name     VARCHAR(80)   NOT NULL,
  last_name      VARCHAR(80)   NOT NULL,
  address_line1  VARCHAR(190)  NULL,
  address_line2  VARCHAR(190)  NULL,
  city           VARCHAR(90)   NULL,
  governorate    VARCHAR(90)   NULL,
  postal_code    VARCHAR(20)   NULL,
  country        CHAR(2)       NOT NULL DEFAULT 'TN',
  pickup_point_id CHAR(24)     NULL,
  pickup_point_name VARCHAR(190) NULL,
  customer_note  TEXT          NULL,
  internal_note  TEXT          NULL,

  discount_code  VARCHAR(40)   NULL,
  placed_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  confirmed_at   DATETIME(3)   NULL,
  completed_at   DATETIME(3)   NULL,
  cancelled_at   DATETIME(3)   NULL,
  cancel_reason  VARCHAR(255)  NULL,
  updated_at     DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_orders_reference (reference),
  KEY idx_orders_customer (customer_id, placed_at),
  KEY idx_orders_status (status, placed_at),
  KEY idx_orders_payment (payment_status),
  KEY idx_orders_placed (placed_at),
  KEY idx_orders_email (email),
  CONSTRAINT fk_orders_customer FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE SET NULL,
  CONSTRAINT fk_orders_pickup FOREIGN KEY (pickup_point_id) REFERENCES pickup_points (id) ON DELETE SET NULL,
  CONSTRAINT ck_orders_totals CHECK (grand_total >= 0 AND subtotal >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Immutable snapshot. Nothing here is read through a join at display time.
CREATE TABLE order_lines (
  id             CHAR(24)      NOT NULL,
  order_id       CHAR(24)      NOT NULL,
  variant_id     CHAR(24)      NULL,   -- analytics only; may become NULL
  product_id     CHAR(24)      NULL,
  sku            VARCHAR(60)   NOT NULL,
  product_name   VARCHAR(190)  NOT NULL,
  variant_format VARCHAR(60)   NOT NULL,
  image_path     VARCHAR(255)  NULL,
  unit_price     DECIMAL(10,3) NOT NULL,
  quantity       INT           NOT NULL,
  line_total     DECIMAL(10,3) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_order_lines_order (order_id),
  KEY idx_order_lines_variant (variant_id),
  CONSTRAINT fk_order_lines_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE,
  CONSTRAINT fk_order_lines_variant FOREIGN KEY (variant_id) REFERENCES product_variants (id) ON DELETE SET NULL,
  CONSTRAINT ck_order_lines_quantity CHECK (quantity > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE order_events (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id   CHAR(24)     NOT NULL,
  type       VARCHAR(60)  NOT NULL,
  message    VARCHAR(255) NULL,
  data       JSON         NULL,
  actor      VARCHAR(80)  NULL,
  created_at DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_order_events_order (order_id, created_at),
  CONSTRAINT fk_order_events_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- No card data is stored in any column, ever. `provider_ref` is the provider's
-- own opaque identifier.
CREATE TABLE payments (
  id             CHAR(24)      NOT NULL,
  order_id       CHAR(24)      NOT NULL,
  method         ENUM('CASH_ON_DELIVERY','CASH_ON_PICKUP','BANK_TRANSFER','ONLINE_GATEWAY') NOT NULL,
  status         ENUM('UNPAID','AUTHORIZED','PAID','FAILED','REFUNDED','CANCELLED') NOT NULL DEFAULT 'UNPAID',
  amount         DECIMAL(10,3) NOT NULL,
  currency       CHAR(3)       NOT NULL DEFAULT 'TND',
  provider       VARCHAR(40)   NOT NULL,
  provider_ref   VARCHAR(190)  NULL,
  failure_reason VARCHAR(255)  NULL,
  paid_at        DATETIME(3)   NULL,
  created_at     DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at     DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_payments_provider_ref (provider, provider_ref),
  KEY idx_payments_order (order_id),
  CONSTRAINT fk_payments_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- A provider that retries a webhook must not be processed twice.
CREATE TABLE webhook_events (
  id           CHAR(24)     NOT NULL,
  provider     VARCHAR(40)  NOT NULL,
  external_id  VARCHAR(190) NOT NULL,
  payload      JSON         NOT NULL,
  processed_at DATETIME(3)  NULL,
  created_at   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_webhook_events (provider, external_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- A double submit, or a retry after a dropped connection, resolves to the same
-- order instead of minting a second one.
CREATE TABLE idempotency_keys (
  `key`      VARCHAR(80) NOT NULL,
  scope      VARCHAR(40) NOT NULL,
  result_id  VARCHAR(64) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  expires_at DATETIME(3) NOT NULL,
  PRIMARY KEY (`key`),
  KEY idx_idempotency_expiry (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Per-year order numbering, so references are BOA-25-0001 and not a cuid.
CREATE TABLE reference_counters (
  scope      VARCHAR(40) NOT NULL,
  period     VARCHAR(10) NOT NULL,
  next_value INT         NOT NULL DEFAULT 1,
  PRIMARY KEY (scope, period)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ──────────────────────────────────────────────────────────────── reservations

CREATE TABLE services (
  id              CHAR(24)      NOT NULL,
  slug            VARCHAR(120)  NOT NULL,
  state           ENUM('DRAFT','PUBLISHED','ARCHIVED') NOT NULL DEFAULT 'DRAFT',
  duration_min    INT           NOT NULL DEFAULT 60,
  capacity        INT           NOT NULL DEFAULT 1,
  price           DECIMAL(10,3) NULL,
  deposit_amount  DECIMAL(10,3) NULL,
  buffer_min      INT           NOT NULL DEFAULT 0,
  lead_time_hours INT           NOT NULL DEFAULT 12,
  horizon_days    INT           NOT NULL DEFAULT 45,
  cover_path      VARCHAR(255)  NULL,
  location_id     CHAR(24)      NULL,
  position        INT           NOT NULL DEFAULT 0,
  created_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at      DATETIME(3)   NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_services_slug (slug),
  KEY idx_services_listing (state, deleted_at, position),
  CONSTRAINT fk_services_location FOREIGN KEY (location_id) REFERENCES pickup_points (id) ON DELETE SET NULL,
  CONSTRAINT ck_services_capacity CHECK (capacity > 0),
  CONSTRAINT ck_services_duration CHECK (duration_min > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE service_translations (
  id               CHAR(24)     NOT NULL,
  service_id       CHAR(24)     NOT NULL,
  locale           ENUM('FR','EN','AR') NOT NULL,
  name             VARCHAR(190) NOT NULL,
  tagline          VARCHAR(255) NULL,
  description      TEXT         NULL,
  preparation      TEXT         NULL,
  meta_title       VARCHAR(190) NULL,
  meta_description VARCHAR(320) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_service_translations (service_id, locale),
  CONSTRAINT fk_service_translations_service FOREIGN KEY (service_id) REFERENCES services (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Recurring weekly window. Slots are materialised from these rules.
CREATE TABLE availability_rules (
  id             CHAR(24)   NOT NULL,
  service_id     CHAR(24)   NOT NULL,
  weekday        TINYINT    NOT NULL,   -- 0 = Sunday
  start_min      SMALLINT   NOT NULL,   -- minutes from local midnight
  end_min        SMALLINT   NOT NULL,
  slot_every_min SMALLINT   NOT NULL DEFAULT 60,
  valid_from     DATE       NULL,
  valid_until    DATE       NULL,
  is_active      TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  KEY idx_availability_rules_service (service_id, weekday),
  CONSTRAINT fk_availability_rules_service FOREIGN KEY (service_id) REFERENCES services (id) ON DELETE CASCADE,
  CONSTRAINT ck_availability_rules_window CHECK (end_min > start_min AND start_min >= 0 AND end_min <= 1440),
  CONSTRAINT ck_availability_rules_weekday CHECK (weekday BETWEEN 0 AND 6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- A closure (is_open = 0) or a one-off opening (is_open = 1).
CREATE TABLE availability_exceptions (
  id         CHAR(24)     NOT NULL,
  service_id CHAR(24)     NOT NULL,
  `date`     DATE         NOT NULL,
  is_open    TINYINT(1)   NOT NULL DEFAULT 0,
  start_min  SMALLINT     NULL,
  end_min    SMALLINT     NULL,
  reason     VARCHAR(160) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_availability_exceptions (service_id, `date`),
  CONSTRAINT fk_availability_exceptions_service FOREIGN KEY (service_id) REFERENCES services (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- A materialised bookable slot. `capacity` is copied from the service at
-- generation time, so raising or lowering the service capacity later cannot
-- retroactively overbook or invalidate an existing slot.
CREATE TABLE slots (
  id         CHAR(24)    NOT NULL,
  service_id CHAR(24)    NOT NULL,
  starts_at  DATETIME(3) NOT NULL,
  ends_at    DATETIME(3) NOT NULL,
  capacity   INT         NOT NULL DEFAULT 1,
  is_blocked TINYINT(1)  NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_slots_service_start (service_id, starts_at),
  KEY idx_slots_lookup (service_id, starts_at, is_blocked),
  CONSTRAINT fk_slots_service FOREIGN KEY (service_id) REFERENCES services (id) ON DELETE CASCADE,
  CONSTRAINT ck_slots_capacity CHECK (capacity > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE reservations (
  id               CHAR(24)      NOT NULL,
  reference        VARCHAR(24)   NOT NULL,
  service_id       CHAR(24)      NOT NULL,
  slot_id          CHAR(24)      NOT NULL,
  customer_id      CHAR(24)      NULL,
  status           ENUM('PENDING','CONFIRMED','COMPLETED','CANCELLED','NO_SHOW') NOT NULL DEFAULT 'PENDING',

  -- Snapshots, for the same reason order lines are snapshots.
  service_name     VARCHAR(190)  NOT NULL,
  starts_at        DATETIME(3)   NOT NULL,
  ends_at          DATETIME(3)   NOT NULL,
  price_at_booking DECIMAL(10,3) NULL,
  location_name    VARCHAR(190)  NULL,

  first_name       VARCHAR(80)   NOT NULL,
  last_name        VARCHAR(80)   NOT NULL,
  email            VARCHAR(190)  NOT NULL,
  phone            VARCHAR(40)   NOT NULL,
  note             TEXT          NULL,
  internal_note    TEXT          NULL,
  locale           ENUM('FR','EN','AR') NOT NULL DEFAULT 'FR',

  created_at       DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at       DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  confirmed_at     DATETIME(3)   NULL,
  cancelled_at     DATETIME(3)   NULL,
  cancel_reason    VARCHAR(255)  NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_reservations_reference (reference),
  KEY idx_reservations_status (status, starts_at),
  KEY idx_reservations_customer (customer_id, starts_at),
  KEY idx_reservations_email (email),
  KEY idx_reservations_service (service_id, starts_at),
  KEY idx_reservations_slot (slot_id),
  CONSTRAINT fk_reservations_service FOREIGN KEY (service_id) REFERENCES services (id),
  CONSTRAINT fk_reservations_slot FOREIGN KEY (slot_id) REFERENCES slots (id),
  CONSTRAINT fk_reservations_customer FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- The concurrency primitive. One row per occupied seat: the unique index on
-- (slot_id, seat_index) turns a double booking into a database error rather
-- than a race the application has to win. Availability shown in the UI is
-- advisory; this table is the authority.
CREATE TABLE reservation_seats (
  id             CHAR(24)    NOT NULL,
  slot_id        CHAR(24)    NOT NULL,
  seat_index     INT         NOT NULL,
  reservation_id CHAR(24)    NOT NULL,
  created_at     DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_reservation_seats_slot_seat (slot_id, seat_index),
  UNIQUE KEY uq_reservation_seats_reservation (reservation_id),
  CONSTRAINT fk_reservation_seats_slot FOREIGN KEY (slot_id) REFERENCES slots (id) ON DELETE CASCADE,
  CONSTRAINT fk_reservation_seats_reservation FOREIGN KEY (reservation_id) REFERENCES reservations (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ───────────────────────────────────────────────────────────────────── content

-- `kind` selects the renderer; `payload` holds the block's non-translatable
-- configuration (referenced ids, ratios, flags).
CREATE TABLE content_blocks (
  id         CHAR(24)    NOT NULL,
  page       VARCHAR(60) NOT NULL DEFAULT 'home',
  kind       VARCHAR(60) NOT NULL,
  position   INT         NOT NULL DEFAULT 0,
  is_visible TINYINT(1)  NOT NULL DEFAULT 1,
  payload    JSON        NULL,
  media_path VARCHAR(255) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_content_blocks_page (page, position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE content_block_translations (
  id        CHAR(24)     NOT NULL,
  block_id  CHAR(24)     NOT NULL,
  locale    ENUM('FR','EN','AR') NOT NULL,
  eyebrow   VARCHAR(120) NULL,
  heading   VARCHAR(255) NULL,
  body      TEXT         NULL,
  cta_label VARCHAR(80)  NULL,
  cta_href  VARCHAR(255) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_content_block_translations (block_id, locale),
  CONSTRAINT fk_content_block_translations_block FOREIGN KEY (block_id) REFERENCES content_blocks (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Nothing is announced unless a row is active and inside its window.
CREATE TABLE announcements (
  id        CHAR(24)    NOT NULL,
  is_active TINYINT(1)  NOT NULL DEFAULT 0,
  starts_at DATETIME(3) NULL,
  ends_at   DATETIME(3) NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE announcement_translations (
  id              CHAR(24)     NOT NULL,
  announcement_id CHAR(24)     NOT NULL,
  locale          ENUM('FR','EN','AR') NOT NULL,
  message         VARCHAR(255) NOT NULL,
  href            VARCHAR(255) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_announcement_translations (announcement_id, locale),
  CONSTRAINT fk_announcement_translations_announcement FOREIGN KEY (announcement_id) REFERENCES announcements (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Typed key/value store for company facts (address, phone, hours, policies) so
-- a non-technical admin can fill them in without a developer.
CREATE TABLE settings (
  `key`      VARCHAR(80) NOT NULL,
  value      JSON        NOT NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE inquiries (
  id         CHAR(24)     NOT NULL,
  kind       ENUM('CONTACT','PROFESSIONAL') NOT NULL DEFAULT 'CONTACT',
  name       VARCHAR(120) NOT NULL,
  email      VARCHAR(190) NOT NULL,
  phone      VARCHAR(40)  NULL,
  company    VARCHAR(160) NULL,
  subject    VARCHAR(190) NULL,
  message    TEXT         NOT NULL,
  is_handled TINYINT(1)   NOT NULL DEFAULT 0,
  created_at DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_inquiries_listing (kind, is_handled, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Applied-migration ledger, written by the migration runner.
CREATE TABLE IF NOT EXISTS schema_migrations (
  name       VARCHAR(190) NOT NULL,
  applied_at DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
