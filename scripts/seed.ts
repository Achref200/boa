/**
 * Development seed.
 *
 * What is real here: BOA's product *names*, which are visible at Tunisian
 * retailers, and BOA's public social links. What is not real, and is labelled
 * as such in `settings.contentToComplete`: every price, every description, all
 * photography, the service catalogue, and the company's contact details. No
 * benefit claim, ingredient list, certification, review or statistic is
 * fabricated anywhere in this file — fields we cannot fill are left NULL, and
 * the product page omits an empty section rather than inventing copy.
 *
 * Refuses to run against a production database unless SEED_FORCE=1.
 */
import { createPool } from 'mysql2/promise';
import { config } from 'dotenv';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';

config({ path: '.env.local', quiet: true });
config({ path: '.env', quiet: true });

const ALPHABET = '0123456789abcdefghjkmnpqrstvwxyz';
let counter = 0;
function id(): string {
  const time = Date.now() + (counter += 1);
  let head = '';
  let value = time;
  for (let i = 0; i < 8; i += 1) { head = ALPHABET[value % 32]! + head; value = Math.floor(value / 32); }
  const bytes = randomBytes(16);
  let tail = '';
  for (let i = 0; i < 16; i += 1) tail += ALPHABET[bytes[i]! % 32];
  return head + tail;
}

const PERMISSIONS: Record<string, string> = {
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
};

const ROLES = [
  { key: 'super_admin', label: 'Super administrateur', permissions: Object.keys(PERMISSIONS) },
  { key: 'catalog_manager', label: 'Responsable catalogue', permissions: ['product.read','product.write','product.publish','catalog.write','inventory.write','content.write'] },
  { key: 'order_manager', label: 'Responsable commandes', permissions: ['order.read','order.write','customer.read','product.read','inventory.write'] },
  { key: 'reservation_manager', label: 'Responsable réservations', permissions: ['reservation.read','reservation.write','service.write','customer.read'] },
];

// Tunisia's 24 governorates, grouped into three delivery zones. The grouping is
// geographic fact; the prices are placeholders for BOA to set.
const ZONES = [
  { name: 'Grand Sousse', price: '5.000', freeAbove: '120.000', eta: '24 h',
    governorates: ['Sousse', 'Monastir', 'Mahdia'] },
  { name: 'Nord et Centre', price: '7.500', freeAbove: '150.000', eta: '48 h',
    governorates: ['Tunis','Ariana','Ben Arous','Manouba','Nabeul','Bizerte','Béja','Jendouba','Le Kef','Siliana','Zaghouan','Kairouan','Sfax'] },
  { name: 'Sud et Ouest', price: '9.500', freeAbove: '180.000', eta: '72 h',
    governorates: ['Gabès','Médenine','Tataouine','Gafsa','Tozeur','Kébili','Sidi Bouzid','Kasserine'] },
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  if (process.env.NODE_ENV === 'production' && process.env.SEED_FORCE !== '1') {
    throw new Error('Refusing to seed a production database. Set SEED_FORCE=1 if you are certain.');
  }

  const pool = createPool({ uri: url, multipleStatements: true, decimalNumbers: false });
  const run = async (sql: string, params: unknown[] = []) => { await pool.query(sql, params); };

  // Development reset. Order matters only because FK checks are off for the wipe.
  const tables = [
    'reservation_seats','reservations','slots','availability_exceptions','availability_rules',
    'service_translations','services','order_events','payments','order_lines','orders',
    'idempotency_keys','webhook_events','reference_counters','cart_items','carts',
    'ritual_step_translations','ritual_steps','ritual_translations','rituals',
    'collection_products','collection_translations','collections','reviews',
    'product_media','product_relations','product_needs','stock_movements','product_variants',
    'product_translations','products','need_translations','needs',
    'category_translations','categories','announcement_translations','announcements',
    'content_block_translations','content_blocks','pickup_point_translations','pickup_points',
    'shipping_zones','discounts','inquiries','addresses','customer_sessions','customers',
    'audit_logs','admin_sessions','admin_users','role_permissions','permissions','roles','settings',
  ];
  await run('SET FOREIGN_KEY_CHECKS = 0');
  for (const table of tables) await run(`TRUNCATE TABLE \`${table}\``);
  await run('SET FOREIGN_KEY_CHECKS = 1');

  // ── access control ────────────────────────────────────────────────────────
  const permissionIds = new Map<string, number>();
  for (const [key, label] of Object.entries(PERMISSIONS)) {
    const [result] = await pool.query('INSERT INTO permissions (`key`, label) VALUES (?, ?)', [key, label]);
    permissionIds.set(key, (result as { insertId: number }).insertId);
  }

  const roleIds = new Map<string, number>();
  for (const role of ROLES) {
    const [result] = await pool.query(
      'INSERT INTO roles (`key`, label, is_system) VALUES (?, ?, 1)', [role.key, role.label],
    );
    const roleId = (result as { insertId: number }).insertId;
    roleIds.set(role.key, roleId);
    for (const permission of role.permissions) {
      await run('INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)', [
        roleId, permissionIds.get(permission),
      ]);
    }
  }

  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@boacosmetic.tn';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? `boa-${randomBytes(9).toString('base64url')}`;
  await run(
    'INSERT INTO admin_users (id, email, password_hash, name, role_id) VALUES (?, ?, ?, ?, ?)',
    [id(), adminEmail, await bcrypt.hash(adminPassword, 12), 'Administrateur BOA', roleIds.get('super_admin')],
  );

  // ── catalogue structure ───────────────────────────────────────────────────
  type Tri = { fr: string; en: string; ar: string };
  const category = async (slug: string, names: Tri, parentId: string | null, position: number) => {
    const cid = id();
    await run(
      'INSERT INTO categories (id, slug, parent_id, position, state) VALUES (?, ?, ?, ?, "PUBLISHED")',
      [cid, slug, parentId, position],
    );
    for (const [locale, name] of [['FR', names.fr], ['EN', names.en], ['AR', names.ar]] as const) {
      await run(
        'INSERT INTO category_translations (id, category_id, locale, name) VALUES (?, ?, ?, ?)',
        [id(), cid, locale, name],
      );
    }
    return cid;
  };

  const hair = await category('cheveux', { fr: 'Cheveux', en: 'Hair', ar: 'الشعر' }, null, 1);
  const shampoos = await category('shampooings', { fr: 'Shampooings', en: 'Shampoos', ar: 'الشامبو' }, hair, 1);
  const treatments = await category('proteine-keratine', { fr: 'Protéine & kératine', en: 'Protein & keratin', ar: 'البروتين والكيراتين' }, hair, 2);
  const masks = await category('masques', { fr: 'Masques', en: 'Masks', ar: 'الأقنعة' }, hair, 3);
  const face = await category('visage', { fr: 'Visage', en: 'Face', ar: 'الوجه' }, null, 2);
  const fragrance = await category('parfums', { fr: 'Parfums', en: 'Fragrance', ar: 'العطور' }, null, 3);

  const need = async (slug: string, names: Tri, position: number) => {
    const nid = id();
    await run('INSERT INTO needs (id, slug, position, state) VALUES (?, ?, ?, "PUBLISHED")', [nid, slug, position]);
    for (const [locale, name] of [['FR', names.fr], ['EN', names.en], ['AR', names.ar]] as const) {
      await run('INSERT INTO need_translations (id, need_id, locale, name) VALUES (?, ?, ?, ?)', [id(), nid, locale, name]);
    }
    return nid;
  };

  const needRepair = await need('reparation', { fr: 'Réparation', en: 'Repair', ar: 'الترميم' }, 1);
  const needSmooth = await need('lissage', { fr: 'Lissage', en: 'Smoothing', ar: 'التنعيم' }, 2);
  const needNourish = await need('nutrition', { fr: 'Nutrition', en: 'Nourishment', ar: 'التغذية' }, 3);
  const needRadiance = await need('eclat', { fr: 'Éclat', en: 'Radiance', ar: 'الإشراق' }, 4);

  // ── products ──────────────────────────────────────────────────────────────
  // Names are real. Every descriptive field is deliberately NULL: BOA writes
  // those in the admin, and the product page omits sections that have no text.
  type SeedProduct = {
    slug: string; reference: string; categoryId: string; state: 'PUBLISHED' | 'DRAFT';
    featured?: boolean; professional?: boolean; needs: string[];
    names: Tri; variants: { sku: string; format: string; price: string; stock: number }[];
  };

  const products: SeedProduct[] = [
    { slug: 'boa-shampoo', reference: 'BOA-SHP', categoryId: shampoos, state: 'PUBLISHED', featured: true,
      needs: [needRepair, needNourish],
      names: { fr: 'BOA Shampoo', en: 'BOA Shampoo', ar: 'شامبو BOA' },
      variants: [
        { sku: 'BOA-SHP-100', format: '100 ml', price: '19.900', stock: 40 },
        { sku: 'BOA-SHP-250', format: '250 ml', price: '34.500', stock: 26 },
      ] },
    { slug: 'boa-shampooing-nano-caviar', reference: 'BOA-NCV', categoryId: shampoos, state: 'PUBLISHED', featured: true,
      needs: [needSmooth, needRadiance],
      names: { fr: 'BOA Shampooing Nano Caviar', en: 'BOA Nano Caviar Shampoo', ar: 'شامبو BOA نانو كافيار' },
      variants: [{ sku: 'BOA-NCV-300', format: '300 ml', price: '45.000', stock: 18 }] },
    { slug: 'boa-masque-cheveux', reference: 'BOA-MSQ', categoryId: masks, state: 'PUBLISHED',
      needs: [needRepair, needNourish],
      names: { fr: 'BOA Masque Cheveux', en: 'BOA Hair Mask', ar: 'قناع الشعر BOA' },
      variants: [{ sku: 'BOA-MSQ-250', format: '250 ml', price: '39.900', stock: 3 }] },
    { slug: 'boa-proteine-mesotherapie-collagene', reference: 'BOA-PMC', categoryId: treatments, state: 'PUBLISHED', featured: true,
      needs: [needRepair, needSmooth],
      names: { fr: 'BOA Protéine Mésothérapie Collagène', en: 'BOA Collagen Mesotherapy Protein', ar: 'بروتين BOA ميزوثيرابي بالكولاجين' },
      variants: [{ sku: 'BOA-PMC-100', format: '100 ml', price: '29.000', stock: 32 }] },
    { slug: 'boa-pack-proteine-caviar', reference: 'BOA-PPC', categoryId: treatments, state: 'PUBLISHED', professional: true,
      needs: [needSmooth],
      names: { fr: 'BOA Pack Protéine Caviar', en: 'BOA Caviar Protein Pack', ar: 'باك بروتين الكافيار BOA' },
      variants: [{ sku: 'BOA-PPC-1L', format: '1 L', price: '149.000', stock: 9 }] },
    // Structure placeholders. BOA's public listing names these product families
    // but no product name is published, so they stay unpublished until BOA fills them in.
    { slug: 'boa-gommage', reference: 'BOA-GOM', categoryId: face, state: 'DRAFT', needs: [needRadiance],
      names: { fr: 'BOA Gommage — à compléter', en: 'BOA Scrub — to complete', ar: 'مقشّر BOA — للإتمام' },
      variants: [{ sku: 'BOA-GOM-200', format: '200 ml', price: '0.000', stock: 0 }] },
    { slug: 'boa-savon-noir', reference: 'BOA-SVN', categoryId: face, state: 'DRAFT', needs: [needRadiance],
      names: { fr: 'BOA Savon Noir — à compléter', en: 'BOA Black Soap — to complete', ar: 'الصابون الأسود BOA — للإتمام' },
      variants: [{ sku: 'BOA-SVN-250', format: '250 g', price: '0.000', stock: 0 }] },
    { slug: 'boa-body-splash', reference: 'BOA-BSP', categoryId: fragrance, state: 'DRAFT', needs: [],
      names: { fr: 'BOA Body Splash — à compléter', en: 'BOA Body Splash — to complete', ar: 'BOA بادي سبلاش — للإتمام' },
      variants: [{ sku: 'BOA-BSP-250', format: '250 ml', price: '0.000', stock: 0 }] },
  ];

  const productIds = new Map<string, string>();
  let position = 0;
  for (const product of products) {
    const pid = id();
    productIds.set(product.slug, pid);
    position += 1;
    await run(
      `INSERT INTO products (id, slug, reference, category_id, state, is_featured, is_professional, position, published_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [pid, product.slug, product.reference, product.categoryId, product.state,
       product.featured ? 1 : 0, product.professional ? 1 : 0, position,
       product.state === 'PUBLISHED' ? new Date() : null],
    );
    for (const [locale, name] of [['FR', product.names.fr], ['EN', product.names.en], ['AR', product.names.ar]] as const) {
      await run(
        'INSERT INTO product_translations (id, product_id, locale, name) VALUES (?, ?, ?, ?)',
        [id(), pid, locale, name],
      );
    }
    let vp = 0;
    for (const variant of product.variants) {
      vp += 1;
      await run(
        `INSERT INTO product_variants (id, product_id, sku, format, price, stock, position, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id(), pid, variant.sku, variant.format, variant.price, variant.stock, vp,
         product.state === 'PUBLISHED' ? 1 : 0],
      );
    }
    for (const needId of product.needs) {
      await run('INSERT INTO product_needs (product_id, need_id) VALUES (?, ?)', [pid, needId]);
    }
  }

  // Complementary relations are editorial choices an admin makes, not a
  // "customers also bought" fiction generated from no data.
  const relate = async (from: string, to: string, pos: number) => {
    await run(
      'INSERT INTO product_relations (id, source_id, target_id, kind, position) VALUES (?, ?, ?, "COMPLEMENTARY", ?)',
      [id(), productIds.get(from), productIds.get(to), pos],
    );
  };
  await relate('boa-shampoo', 'boa-masque-cheveux', 1);
  await relate('boa-shampoo', 'boa-proteine-mesotherapie-collagene', 2);
  await relate('boa-masque-cheveux', 'boa-shampoo', 1);
  await relate('boa-proteine-mesotherapie-collagene', 'boa-shampooing-nano-caviar', 1);

  // ── ritual ────────────────────────────────────────────────────────────────
  const ritualId = id();
  await run('INSERT INTO rituals (id, slug, state, position) VALUES (?, "rituel-proteine", "PUBLISHED", 1)', [ritualId]);
  for (const [locale, name] of [
    ['FR', 'Rituel Protéine'], ['EN', 'Protein Ritual'], ['AR', 'روتين البروتين'],
  ] as const) {
    await run('INSERT INTO ritual_translations (id, ritual_id, locale, name) VALUES (?, ?, ?, ?)', [id(), ritualId, locale, name]);
  }
  const steps: [string, Tri][] = [
    ['boa-shampoo', { fr: 'Laver', en: 'Cleanse', ar: 'الغسل' }],
    ['boa-proteine-mesotherapie-collagene', { fr: 'Traiter', en: 'Treat', ar: 'المعالجة' }],
    ['boa-masque-cheveux', { fr: 'Sceller', en: 'Seal', ar: 'التثبيت' }],
  ];
  let stepPosition = 0;
  for (const [slug, titles] of steps) {
    const stepId = id();
    stepPosition += 1;
    await run('INSERT INTO ritual_steps (id, ritual_id, product_id, position) VALUES (?, ?, ?, ?)',
      [stepId, ritualId, productIds.get(slug), stepPosition]);
    for (const [locale, title] of [['FR', titles.fr], ['EN', titles.en], ['AR', titles.ar]] as const) {
      await run('INSERT INTO ritual_step_translations (id, step_id, locale, title) VALUES (?, ?, ?, ?)',
        [id(), stepId, locale, title]);
    }
  }

  // ── pickup, shipping ──────────────────────────────────────────────────────
  const pickupId = id();
  await run(
    `INSERT INTO pickup_points (id, slug, is_active, address_line, city, governorate, position)
     VALUES (?, 'boa-sousse', 1, 'Adresse à compléter', 'Sousse', 'Sousse', 1)`, [pickupId],
  );
  for (const [locale, name] of [
    ['FR', 'BOA Cosmetic — Sousse'], ['EN', 'BOA Cosmetic — Sousse'], ['AR', 'BOA Cosmetic — سوسة'],
  ] as const) {
    await run('INSERT INTO pickup_point_translations (id, point_id, locale, name) VALUES (?, ?, ?, ?)',
      [id(), pickupId, locale, name]);
  }

  let zonePosition = 0;
  for (const zone of ZONES) {
    zonePosition += 1;
    await run(
      `INSERT INTO shipping_zones (id, name, governorates, price, free_above, eta_days, is_active, position)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
      [id(), zone.name, JSON.stringify(zone.governorates), zone.price, zone.freeAbove, zone.eta, zonePosition],
    );
  }

  // ── service + availability ────────────────────────────────────────────────
  const serviceId = id();
  await run(
    `INSERT INTO services (id, slug, state, duration_min, capacity, price, lead_time_hours, horizon_days, location_id, position)
     VALUES (?, 'diagnostic-cheveux', 'PUBLISHED', 45, 1, NULL, 12, 45, ?, 1)`,
    [serviceId, pickupId],
  );
  for (const [locale, name] of [
    ['FR', 'Diagnostic cheveux'], ['EN', 'Hair diagnosis'], ['AR', 'تشخيص الشعر'],
  ] as const) {
    await run('INSERT INTO service_translations (id, service_id, locale, name) VALUES (?, ?, ?, ?)',
      [id(), serviceId, locale, name]);
  }
  // Tuesday to Saturday, 09:00–17:00, one appointment an hour.
  for (const weekday of [2, 3, 4, 5, 6]) {
    await run(
      `INSERT INTO availability_rules (id, service_id, weekday, start_min, end_min, slot_every_min)
       VALUES (?, ?, ?, 540, 1020, 60)`, [id(), serviceId, weekday],
    );
  }

  // ── homepage composition ──────────────────────────────────────────────────
  const block = async (
    kind: string, pos: number,
    copy: { fr: [string | null, string | null, string | null]; en: [string | null, string | null, string | null]; ar: [string | null, string | null, string | null] },
    payload: Record<string, unknown> = {},
  ) => {
    const bid = id();
    await run(
      'INSERT INTO content_blocks (id, page, kind, position, is_visible, payload) VALUES (?, "home", ?, ?, 1, ?)',
      [bid, kind, pos, JSON.stringify(payload)],
    );
    for (const [locale, values] of [['FR', copy.fr], ['EN', copy.en], ['AR', copy.ar]] as const) {
      await run(
        'INSERT INTO content_block_translations (id, block_id, locale, eyebrow, heading, body) VALUES (?, ?, ?, ?, ?, ?)',
        [id(), bid, locale, values[0], values[1], values[2]],
      );
    }
  };

  await block('hero', 1, {
    fr: ['Sousse, Tunisie', 'La protéine, prise au sérieux.', 'BOA formule des soins capillaires et des soins visage en Tunisie.'],
    en: ['Sousse, Tunisia', 'Protein, taken seriously.', 'BOA formulates hair and face care in Tunisia.'],
    ar: ['سوسة، تونس', 'البروتين، بجدّية.', 'BOA تصنع منتجات العناية بالشعر والوجه في تونس.'],
  }, { productSlug: 'boa-proteine-mesotherapie-collagene' });

  await block('needs', 2, {
    fr: ['Par besoin', 'Commencez par ce que vivent vos cheveux.', null],
    en: ['By concern', 'Start with what your hair is going through.', null],
    ar: ['حسب الحاجة', 'ابدئي بما يحتاجه شعرك فعلاً.', null],
  });

  await block('signature', 3, {
    fr: ['Signatures', 'Les soins que BOA fabrique.', null],
    en: ['Signatures', 'What BOA makes.', null],
    ar: ['منتجاتنا المميّزة', 'ما تصنعه BOA.', null],
  });

  await block('maison', 4, {
    fr: ['La maison', 'Formulé à Sousse.', 'Texte de présentation à compléter depuis l’administration.'],
    en: ['The house', 'Formulated in Sousse.', 'Introduction text to complete from the admin.'],
    ar: ['الدار', 'مصنوع في سوسة.', 'نص التقديم يُستكمل من لوحة الإدارة.'],
  });

  await block('rituals', 5, {
    fr: ['Rituels', 'Un geste après l’autre.', null],
    en: ['Rituals', 'One step after another.', null],
    ar: ['الروتينات', 'خطوة بعد خطوة.', null],
  });

  await block('services', 6, {
    fr: ['En institut', 'Prendre rendez-vous.', null],
    en: ['In the studio', 'Book an appointment.', null],
    ar: ['في المركز', 'حجز موعد.', null],
  });

  // ── settings ──────────────────────────────────────────────────────────────
  // Confirmed values only. Everything else stays empty and is listed for BOA.
  const settings: Record<string, unknown> = {
    city: 'Sousse',
    facebookUrl: 'https://www.facebook.com/boacosmetic/',
    instagramUrl: 'https://www.instagram.com/boacosmetic/',
    contactEmail: '',
    contactPhone: '',
    addressLine: '',
    openingHours: '',
    legalNotice: '',
    returnPolicy: '',
    contentToComplete: [
      'Prix de tous les produits (valeurs de démonstration)',
      'Descriptions, mode d’emploi, composition, précautions',
      'Photographies produit (aucun visuel fourni)',
      'Coordonnées : adresse, téléphone, e-mail, horaires',
      'Zones et tarifs de livraison',
      'Services proposés à la réservation et leurs tarifs',
      'Mentions légales et politique de retour',
    ],
  };
  for (const [key, value] of Object.entries(settings)) {
    await run('INSERT INTO settings (`key`, value) VALUES (?, ?)', [key, JSON.stringify(value)]);
  }

  await pool.end();

  console.warn('\nSeed complete.');
  console.warn(`  Admin sign-in: ${adminEmail}`);
  if (!process.env.SEED_ADMIN_PASSWORD) {
    console.warn(`  Generated password: ${adminPassword}`);
    console.warn('  (Set SEED_ADMIN_PASSWORD to choose your own. Change it after first sign-in.)\n');
  }
}

main().catch((error) => { console.error(error); process.exit(1); });
