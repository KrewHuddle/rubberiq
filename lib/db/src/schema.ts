/**
 * RubberIQ schema — Drizzle (PostgreSQL).
 *
 * Sections mirror the v2 spec §3 Data Model:
 *   1. Core (product)
 *   2. Wholesaler
 *   3. Disposal
 *   4. Three-tier backend + sales engine
 *
 * Conventions:
 *   - Snake_case in DB, camelCase in TS (drizzle `casing: 'snake_case'`).
 *   - All money fields stored as integer cents.
 *   - All timestamps stored as `timestamp with time zone`.
 *   - jsonb used for flexible config (goalConfig, signupRate, accelerators).
 */

import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  pgEnum,
  index,
  uniqueIndex,
  primaryKey,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

/* ============================================================================
 * Enums
 * ========================================================================= */

export const userRoleEnum = pgEnum('user_role', [
  'owner',
  'manager',
  'counter',
  'intake',
]);

export const platformRoleEnum = pgEnum('platform_role', [
  'super_admin',
  'sales_agent',
  'support',
]);

export const tireStatusEnum = pgEnum('tire_status', [
  'intake_review',
  'in_stock',
  'reserved',
  'sold',
  'scrapped',
  'rejected',
]);

export const tireGradeEnum = pgEnum('tire_grade', ['A', 'B', 'C', 'D', 'FAIL']);

export const invoiceStatusEnum = pgEnum('invoice_status', [
  'draft',
  'estimate',
  'pending',
  'paid',
  'void',
  'refunded',
]);

export const scrapStatusEnum = pgEnum('scrap_status', [
  'on_hand',
  'awaiting_haul',
  'in_transit',
  'delivered',
]);

export const haulStatusEnum = pgEnum('haul_status', [
  'scheduled',
  'in_transit',
  'completed',
  'cancelled',
]);

export const onboardingStepEnum = pgEnum('onboarding_step', [
  'details',
  'agreement',
  'payment',
  'config',
  'invite_staff',
  'done',
]);

export const commissionTypeEnum = pgEnum('commission_type', [
  'signup',
  'residual',
  'upsell',
]);

export const healthBandEnum = pgEnum('health_band', ['green', 'yellow', 'red']);

export const alertTypeEnum = pgEnum('alert_type', [
  'churn_risk',
  'payment_failed',
  'dormant',
  'upsell_opportunity',
]);

export const alertStatusEnum = pgEnum('alert_status', ['open', 'ack', 'resolved']);

/* ============================================================================
 * 1. Core (product)
 * ========================================================================= */

export const shops = pgTable(
  'shops',
  {
    id: uuid().primaryKey().defaultRandom(),
    name: text().notNull(),
    slug: text().notNull(),
    state: text().notNull(), // 'NC', 'PA', ...
    addressLine1: text(),
    addressLine2: text(),
    city: text(),
    postalCode: text(),
    timezone: text().notNull().default('America/New_York'),
    defaultLanguage: text().notNull().default('en'),
    stripeAccountId: text(),
    stripeConnectStatus: text(),
    subscriptionStatus: text().notNull().default('trial'),
    disposalFeeCents: integer().notNull().default(300),
    pricingFloorMarginBps: integer().notNull().default(2000), // 20%
    branding: jsonb().$type<Record<string, unknown>>(),
    healthScore: integer(),
    healthBand: healthBandEnum(),
    healthUpdatedAt: timestamp({ withTimezone: true }),
    attributedAgentId: uuid(),
    suspendedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    slugIdx: uniqueIndex('shops_slug_idx').on(t.slug),
    agentIdx: index('shops_agent_idx').on(t.attributedAgentId),
  }),
);

export const users = pgTable(
  'users',
  {
    id: uuid().primaryKey().defaultRandom(),
    shopId: uuid()
      .notNull()
      .references(() => shops.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    email: text().notNull(),
    passwordHash: text().notNull(),
    role: userRoleEnum().notNull(),
    language: text().notNull().default('en'),
    lastLoginAt: timestamp({ withTimezone: true }),
    disabledAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    emailIdx: uniqueIndex('users_shop_email_idx').on(t.shopId, t.email),
  }),
);

export const customers = pgTable(
  'customers',
  {
    id: uuid().primaryKey().defaultRandom(),
    shopId: uuid()
      .notNull()
      .references(() => shops.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    phone: text(),
    email: text(),
    language: text().notNull().default('en'),
    notes: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    phoneIdx: index('customers_phone_idx').on(t.shopId, t.phone),
  }),
);

export const vehicles = pgTable('vehicles', {
  id: uuid().primaryKey().defaultRandom(),
  customerId: uuid()
    .notNull()
    .references(() => customers.id, { onDelete: 'cascade' }),
  vin: text(),
  plate: text(),
  year: integer(),
  make: text(),
  model: text(),
  oeSize: text(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

/**
 * Tires — a tire is a unit with a lifecycle.
 * Identity: brand/model/size/dot
 * Condition: treadDepth32nds (tread in 32nds, e.g. 8 = 8/32"), ageMonths
 * Pricing: priceCents, costCents
 * Lifecycle: status, intakePhotoUrl, gradeReason
 * Provenance: source (intake|wholesale|trade_in), wholesaleOrderId, intakeUserId
 */
export const tires = pgTable(
  'tires',
  {
    id: uuid().primaryKey().defaultRandom(),
    shopId: uuid()
      .notNull()
      .references(() => shops.id, { onDelete: 'cascade' }),

    // Identity
    brand: text(),
    model: text(),
    size: text().notNull(), // "P225/65R17"
    dotCode: text(),
    dotWeek: integer(),
    dotYear: integer(),
    loadIndex: text(),
    speedRating: text(),

    // Condition
    treadDepth32nds: integer(),
    ageMonths: integer(),

    // Grade
    grade: tireGradeEnum(),
    gradeReason: jsonb().$type<{
      treadDepth?: number;
      ageMonths?: number;
      flags?: string[];
      notes?: string;
    }>(),
    visionConfidence: integer(), // 0-100

    // Pricing (cents)
    priceCents: integer(),
    costCents: integer(),
    benchmarkCents: integer(),

    // Lifecycle
    status: tireStatusEnum().notNull().default('intake_review'),
    intakePhotoUrl: text(),
    sidewallPhotoUrl: text(),
    treadPhotoUrl: text(),

    // Provenance
    source: text().notNull().default('intake'), // intake | wholesale | trade_in
    wholesaleOrderId: uuid(),
    intakeUserId: uuid(),

    soldAt: timestamp({ withTimezone: true }),
    scrappedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    shopStatusIdx: index('tires_shop_status_idx').on(t.shopId, t.status),
    sizeIdx: index('tires_size_idx').on(t.shopId, t.size),
    dotIdx: index('tires_dot_idx').on(t.dotCode),
  }),
);

export const invoices = pgTable('invoices', {
  id: uuid().primaryKey().defaultRandom(),
  shopId: uuid()
    .notNull()
    .references(() => shops.id, { onDelete: 'cascade' }),
  customerId: uuid().references(() => customers.id),
  vehicleId: uuid().references(() => vehicles.id),
  status: invoiceStatusEnum().notNull().default('draft'),
  subtotalCents: integer().notNull().default(0),
  taxCents: integer().notNull().default(0),
  disposalCents: integer().notNull().default(0),
  totalCents: integer().notNull().default(0),
  stripePaymentIntentId: text(),
  stripeChargeId: text(),
  paymentMethod: text(), // 'card_online' | 'card_terminal' | 'cash' | 'other'
  paidAt: timestamp({ withTimezone: true }),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const invoiceLines = pgTable('invoice_lines', {
  id: uuid().primaryKey().defaultRandom(),
  invoiceId: uuid()
    .notNull()
    .references(() => invoices.id, { onDelete: 'cascade' }),
  type: text().notNull(), // 'used_tire' | 'new_tire' | 'service' | 'disposal_fee'
  tireId: uuid().references(() => tires.id),
  description: text().notNull(),
  quantity: integer().notNull().default(1),
  unitPriceCents: integer().notNull(),
  totalCents: integer().notNull(),
});

/**
 * saleDocs — auto-generated liability/disclosure record per used-tire sale.
 * Captures tread photos, DOT, grade. If ageMonths > threshold, requires sign-off.
 */
export const saleDocs = pgTable('sale_docs', {
  id: uuid().primaryKey().defaultRandom(),
  invoiceId: uuid()
    .notNull()
    .references(() => invoices.id, { onDelete: 'cascade' }),
  tireId: uuid()
    .notNull()
    .references(() => tires.id),
  language: text().notNull().default('en'),
  treadPhotoUrl: text(),
  sidewallPhotoUrl: text(),
  dotCode: text(),
  ageMonths: integer(),
  grade: tireGradeEnum(),
  ageDisclosureRequired: boolean().notNull().default(false),
  customerSignatureUrl: text(),
  signedAt: timestamp({ withTimezone: true }),
  pdfUrl: text(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

/* ============================================================================
 * 2. Wholesaler
 * ========================================================================= */

export const wholesaleCatalog = pgTable(
  'wholesale_catalog',
  {
    id: uuid().primaryKey().defaultRandom(),
    adapter: text().notNull(), // 'tirewire' | 'tireconnect'
    externalId: text().notNull(),
    brand: text(),
    model: text(),
    size: text().notNull(),
    loadIndex: text(),
    speedRating: text(),
    priceCents: integer(),
    inStock: boolean().notNull().default(true),
    raw: jsonb().$type<Record<string, unknown>>(),
    fetchedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    adapterExtIdx: uniqueIndex('wholesale_adapter_ext_idx').on(t.adapter, t.externalId),
    sizeIdx: index('wholesale_size_idx').on(t.size),
  }),
);

export const wholesaleOrders = pgTable('wholesale_orders', {
  id: uuid().primaryKey().defaultRandom(),
  shopId: uuid()
    .notNull()
    .references(() => shops.id, { onDelete: 'cascade' }),
  adapter: text().notNull(),
  externalOrderId: text(),
  status: text().notNull().default('pending'),
  totalCents: integer().notNull().default(0),
  raw: jsonb().$type<Record<string, unknown>>(),
  placedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

/* ============================================================================
 * 3. Disposal (Module 11)
 * ========================================================================= */

export const haulers = pgTable('haulers', {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull(),
  state: text().notNull(),
  permitNumber: text(), // PA Act 90 transporter auth, NC equivalent
  permitExpiresOn: timestamp({ withTimezone: true }),
  contactName: text(),
  contactPhone: text(),
  contactEmail: text(),
  truckCapacity: integer(),
  verified: boolean().notNull().default(false),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const destinationFacilities = pgTable('destination_facilities', {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull(),
  state: text().notNull(),
  permitNumber: text(),
  permitExpiresOn: timestamp({ withTimezone: true }),
  addressLine1: text(),
  city: text(),
  postalCode: text(),
  permitCopyUrl: text(),
  verified: boolean().notNull().default(false),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const scrapTires = pgTable(
  'scrap_tires',
  {
    id: uuid().primaryKey().defaultRandom(),
    shopId: uuid()
      .notNull()
      .references(() => shops.id, { onDelete: 'cascade' }),
    tireId: uuid().references(() => tires.id),
    status: scrapStatusEnum().notNull().default('on_hand'),
    reason: text(), // 'fail_grade' | 'aged_out' | 'damaged' | 'customer_swap'
    haulId: uuid(),
    onHandSince: timestamp({ withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    shopStatusIdx: index('scrap_shop_status_idx').on(t.shopId, t.status),
  }),
);

export const hauls = pgTable('hauls', {
  id: uuid().primaryKey().defaultRandom(),
  shopId: uuid()
    .notNull()
    .references(() => shops.id, { onDelete: 'cascade' }),
  haulerId: uuid()
    .notNull()
    .references(() => haulers.id),
  destinationFacilityId: uuid()
    .notNull()
    .references(() => destinationFacilities.id),
  status: haulStatusEnum().notNull().default('scheduled'),
  scheduledFor: timestamp({ withTimezone: true }),
  pickedUpAt: timestamp({ withTimezone: true }),
  deliveredAt: timestamp({ withTimezone: true }),
  tireCount: integer().notNull().default(0),
  manifestUrl: text(), // PA Act 90 manifest copy
  ncCertificationUrl: text(), // NC Scrap Tire Certification (Parts I/II)
  feeCents: integer().notNull().default(0),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const disposalFees = pgTable('disposal_fees', {
  id: uuid().primaryKey().defaultRandom(),
  state: text().notNull(),
  perTireCents: integer().notNull(),
  effectiveFrom: timestamp({ withTimezone: true }).notNull(),
  notes: text(),
});

/* ============================================================================
 * 4. Three-tier backend + sales engine
 * ========================================================================= */

export const platformUsers = pgTable(
  'platform_users',
  {
    id: uuid().primaryKey().defaultRandom(),
    name: text().notNull(),
    email: text().notNull(),
    passwordHash: text().notNull(),
    role: platformRoleEnum().notNull(),
    language: text().notNull().default('en'),
    disabledAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    emailIdx: uniqueIndex('platform_users_email_idx').on(t.email),
  }),
);

export const salesAgents = pgTable('sales_agents', {
  id: uuid().primaryKey().defaultRandom(),
  platformUserId: uuid()
    .notNull()
    .references(() => platformUsers.id, { onDelete: 'cascade' }),
  name: text().notNull(),
  territory: text(),
  /** Per-period targets, e.g. {period: '2026-Q2', shopsTarget: 10, revenueTarget: 50000, upsellTarget: 5} */
  goalConfig: jsonb().$type<
    Array<{
      period: string;
      shopsTarget?: number;
      revenueTarget?: number;
      upsellTarget?: number;
    }>
  >(),
  commissionPlanId: uuid(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

/** Attribution: which agent owns which shop */
export const agentAccounts = pgTable(
  'agent_accounts',
  {
    id: uuid().primaryKey().defaultRandom(),
    agentId: uuid()
      .notNull()
      .references(() => salesAgents.id, { onDelete: 'cascade' }),
    shopId: uuid()
      .notNull()
      .references(() => shops.id, { onDelete: 'cascade' }),
    signedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    signupCommissionPaid: boolean().notNull().default(false),
  },
  (t) => ({
    agentShopIdx: uniqueIndex('agent_accounts_agent_shop_idx').on(t.agentId, t.shopId),
    shopIdx: index('agent_accounts_shop_idx').on(t.shopId),
  }),
);

/**
 * commissionPlans — configurable commission structures.
 * - signupRate: { kind: 'flat', amountCents } | { kind: 'percent', bps, ofMonths }
 * - residualRate: bps of monthly subscription
 * - residualTerm: 'life' or integer months — default 'life'
 * - upsellAttribution: 'upseller' | 'signer' | 'split' — default 'upseller'
 * - accelerators: optional goal-based bonuses
 */
export const commissionPlans = pgTable('commission_plans', {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull(),
  signupRate: jsonb()
    .$type<
      | { kind: 'flat'; amountCents: number }
      | { kind: 'percent'; bps: number; ofMonths: number }
    >()
    .notNull(),
  residualRateBps: integer().notNull(), // bps of subscription, e.g. 1000 = 10%
  residualTerm: text().notNull().default('life'), // 'life' | integer months
  upsellRateBps: integer().notNull().default(1000),
  upsellAttribution: text().notNull().default('upseller'),
  accelerators: jsonb().$type<Array<Record<string, unknown>>>(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const commissionEvents = pgTable(
  'commission_events',
  {
    id: uuid().primaryKey().defaultRandom(),
    agentId: uuid()
      .notNull()
      .references(() => salesAgents.id, { onDelete: 'cascade' }),
    shopId: uuid()
      .notNull()
      .references(() => shops.id, { onDelete: 'cascade' }),
    type: commissionTypeEnum().notNull(),
    basisCents: integer().notNull(), // the amount the commission was computed on
    rateAppliedBps: integer(), // null for flat signup
    amountEarnedCents: integer().notNull(),
    period: text().notNull(), // 'YYYY-MM' for residual; signup/upsell timestamped
    paidOutAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    agentPeriodIdx: index('commission_agent_period_idx').on(t.agentId, t.period),
    shopIdx: index('commission_shop_idx').on(t.shopId),
  }),
);

export const healthSignals = pgTable(
  'health_signals',
  {
    id: uuid().primaryKey().defaultRandom(),
    shopId: uuid()
      .notNull()
      .references(() => shops.id, { onDelete: 'cascade' }),
    period: text().notNull(), // 'YYYY-MM-DD' (weekly snapshot)
    loginFrequency: integer(),
    intakeVolume: integer(),
    salesActivity: integer(),
    daysSinceLastActivity: integer(),
    paymentStatus: text(),
    supportFlags: integer(),
    computedScore: integer().notNull(),
    band: healthBandEnum().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    shopPeriodIdx: uniqueIndex('health_shop_period_idx').on(t.shopId, t.period),
  }),
);

export const accountAlerts = pgTable(
  'account_alerts',
  {
    id: uuid().primaryKey().defaultRandom(),
    shopId: uuid()
      .notNull()
      .references(() => shops.id, { onDelete: 'cascade' }),
    agentId: uuid().references(() => salesAgents.id),
    type: alertTypeEnum().notNull(),
    severity: integer().notNull().default(1), // 1=info, 2=warn, 3=critical
    message: text().notNull(),
    status: alertStatusEnum().notNull().default('open'),
    acknowledgedAt: timestamp({ withTimezone: true }),
    resolvedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    shopStatusIdx: index('alerts_shop_status_idx').on(t.shopId, t.status),
    agentStatusIdx: index('alerts_agent_status_idx').on(t.agentId, t.status),
  }),
);

export const onboardingSessions = pgTable('onboarding_sessions', {
  id: uuid().primaryKey().defaultRandom(),
  shopId: uuid().references(() => shops.id, { onDelete: 'cascade' }),
  agentId: uuid().references(() => salesAgents.id),
  step: onboardingStepEnum().notNull().default('details'),
  email: text(),
  agreementSignedAt: timestamp({ withTimezone: true }),
  agreementPdfUrl: text(),
  stripeConnectStatus: text(),
  stripeAccountId: text(),
  data: jsonb().$type<Record<string, unknown>>(), // step-collected data
  completedAt: timestamp({ withTimezone: true }),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const demoEnvironments = pgTable('demo_environments', {
  id: uuid().primaryKey().defaultRandom(),
  ownerPlatformUserId: uuid()
    .notNull()
    .references(() => platformUsers.id, { onDelete: 'cascade' }),
  sandboxShopId: uuid().references(() => shops.id),
  seededAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  lastResetAt: timestamp({ withTimezone: true }),
});

/* ============================================================================
 * Relations
 * ========================================================================= */

export const shopsRelations = relations(shops, ({ many, one }) => ({
  users: many(users),
  customers: many(customers),
  tires: many(tires),
  invoices: many(invoices),
  scrapTires: many(scrapTires),
  hauls: many(hauls),
  agentAccount: many(agentAccounts),
  healthSignals: many(healthSignals),
  alerts: many(accountAlerts),
  attributedAgent: one(salesAgents, {
    fields: [shops.attributedAgentId],
    references: [salesAgents.id],
  }),
}));

export const tiresRelations = relations(tires, ({ one }) => ({
  shop: one(shops, { fields: [tires.shopId], references: [shops.id] }),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  shop: one(shops, { fields: [invoices.shopId], references: [shops.id] }),
  customer: one(customers, { fields: [invoices.customerId], references: [customers.id] }),
  vehicle: one(vehicles, { fields: [invoices.vehicleId], references: [vehicles.id] }),
  lines: many(invoiceLines),
  saleDocs: many(saleDocs),
}));

export const invoiceLinesRelations = relations(invoiceLines, ({ one }) => ({
  invoice: one(invoices, { fields: [invoiceLines.invoiceId], references: [invoices.id] }),
  tire: one(tires, { fields: [invoiceLines.tireId], references: [tires.id] }),
}));

export const salesAgentsRelations = relations(salesAgents, ({ many, one }) => ({
  accounts: many(agentAccounts),
  commissionEvents: many(commissionEvents),
  alerts: many(accountAlerts),
  platformUser: one(platformUsers, {
    fields: [salesAgents.platformUserId],
    references: [platformUsers.id],
  }),
}));

export const agentAccountsRelations = relations(agentAccounts, ({ one }) => ({
  agent: one(salesAgents, { fields: [agentAccounts.agentId], references: [salesAgents.id] }),
  shop: one(shops, { fields: [agentAccounts.shopId], references: [shops.id] }),
}));

/* ============================================================================
 * Types
 * ========================================================================= */

export type Shop = typeof shops.$inferSelect;
export type NewShop = typeof shops.$inferInsert;
export type User = typeof users.$inferSelect;
export type Tire = typeof tires.$inferSelect;
export type NewTire = typeof tires.$inferInsert;
export type Invoice = typeof invoices.$inferSelect;
export type SaleDoc = typeof saleDocs.$inferSelect;
export type SalesAgent = typeof salesAgents.$inferSelect;
export type CommissionEvent = typeof commissionEvents.$inferSelect;
export type CommissionPlan = typeof commissionPlans.$inferSelect;
export type HealthSignal = typeof healthSignals.$inferSelect;
export type AccountAlert = typeof accountAlerts.$inferSelect;
export type OnboardingSession = typeof onboardingSessions.$inferSelect;

// Touch sql import to satisfy unused-import lint in case future generated SQL helpers land here.
export const _internal = sql;
