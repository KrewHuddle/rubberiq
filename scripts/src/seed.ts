/**
 * RubberIQ — dev seed.
 *
 * Creates (idempotent):
 *   - 1 shop: slug `demo`, NC, single-bay
 *   - 1 shop owner: owner@demo.rubberiq.com
 *   - 1 platform super-admin: admin@rubberiq.com
 *
 * Passwords are read from env (SEED_OWNER_PASSWORD, SEED_ADMIN_PASSWORD) or
 * fall back to "demo!1234" / "admin!1234" for local dev. NEVER use the
 * fallbacks in any environment other than local.
 *
 * Run:
 *   DATABASE_URL=postgres://... pnpm db:seed
 */

import bcrypt from 'bcryptjs';
import { eq, and } from 'drizzle-orm';
import { getDb, getPool, schema } from '@rubberiq/db';

const SHOP_SLUG = 'demo';
const OWNER_EMAIL = 'owner@demo.rubberiq.com';
const ADMIN_EMAIL = 'admin@rubberiq.com';

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.error('seed: DATABASE_URL not set');
    process.exit(1);
  }

  const ownerPassword = process.env.SEED_OWNER_PASSWORD ?? 'demo!1234';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'admin!1234';

  if (
    (!process.env.SEED_OWNER_PASSWORD || !process.env.SEED_ADMIN_PASSWORD) &&
    !process.env.DATABASE_URL.includes('localhost') &&
    !process.env.DATABASE_URL.includes('127.0.0.1')
  ) {
    console.error(
      'seed: refusing to use fallback dev passwords against a non-local DATABASE_URL.\n' +
        'set SEED_OWNER_PASSWORD and SEED_ADMIN_PASSWORD before re-running.',
    );
    process.exit(1);
  }

  const db = getDb();

  // ---- shop ----
  const existingShop = await db.query.shops.findFirst({
    where: eq(schema.shops.slug, SHOP_SLUG),
  });

  let shopId: string;
  if (existingShop) {
    shopId = existingShop.id;
    console.log(`seed: shop "${SHOP_SLUG}" exists (id=${shopId})`);
  } else {
    const [shop] = await db
      .insert(schema.shops)
      .values({
        name: 'Demo Tire Shop',
        slug: SHOP_SLUG,
        state: 'NC',
        addressLine1: '100 Main St',
        city: 'Charlotte',
        postalCode: '28202',
        timezone: 'America/New_York',
        defaultLanguage: 'en',
        subscriptionStatus: 'trial',
        disposalFeeCents: 300,
        pricingFloorMarginBps: 2000,
      })
      .returning({ id: schema.shops.id });
    shopId = shop.id;
    console.log(`seed: shop "${SHOP_SLUG}" created (id=${shopId})`);
  }

  // ---- shop owner ----
  const existingOwner = await db.query.users.findFirst({
    where: and(eq(schema.users.shopId, shopId), eq(schema.users.email, OWNER_EMAIL)),
  });

  if (existingOwner) {
    console.log(`seed: owner ${OWNER_EMAIL} exists (id=${existingOwner.id})`);
  } else {
    const passwordHash = await bcrypt.hash(ownerPassword, 12);
    const [owner] = await db
      .insert(schema.users)
      .values({
        shopId,
        name: 'Demo Owner',
        email: OWNER_EMAIL,
        passwordHash,
        role: 'owner',
        language: 'en',
      })
      .returning({ id: schema.users.id });
    console.log(`seed: owner ${OWNER_EMAIL} created (id=${owner.id})`);
  }

  // ---- platform super-admin ----
  const existingAdmin = await db.query.platformUsers.findFirst({
    where: eq(schema.platformUsers.email, ADMIN_EMAIL),
  });

  if (existingAdmin) {
    console.log(`seed: admin ${ADMIN_EMAIL} exists (id=${existingAdmin.id})`);
  } else {
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    const [admin] = await db
      .insert(schema.platformUsers)
      .values({
        name: 'Platform Admin',
        email: ADMIN_EMAIL,
        passwordHash,
        role: 'super_admin',
        language: 'en',
      })
      .returning({ id: schema.platformUsers.id });
    console.log(`seed: admin ${ADMIN_EMAIL} created (id=${admin.id})`);
  }

  console.log('\nseed: complete.');
  console.log('  shop slug: %s', SHOP_SLUG);
  console.log('  shop owner: %s', OWNER_EMAIL);
  console.log('  platform admin: %s', ADMIN_EMAIL);
  if (!process.env.SEED_OWNER_PASSWORD) {
    console.log('  (dev passwords — set SEED_OWNER_PASSWORD / SEED_ADMIN_PASSWORD to override)');
  }

  await getPool().end();
}

main().catch((err) => {
  console.error('seed failed:', err);
  process.exit(1);
});
