CREATE TYPE "public"."alert_status" AS ENUM('open', 'ack', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."alert_type" AS ENUM('churn_risk', 'payment_failed', 'dormant', 'upsell_opportunity');--> statement-breakpoint
CREATE TYPE "public"."commission_type" AS ENUM('signup', 'residual', 'upsell');--> statement-breakpoint
CREATE TYPE "public"."haul_status" AS ENUM('scheduled', 'in_transit', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."health_band" AS ENUM('green', 'yellow', 'red');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('draft', 'estimate', 'pending', 'paid', 'void', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."onboarding_step" AS ENUM('details', 'agreement', 'payment', 'config', 'invite_staff', 'done');--> statement-breakpoint
CREATE TYPE "public"."platform_role" AS ENUM('super_admin', 'sales_agent', 'support');--> statement-breakpoint
CREATE TYPE "public"."scrap_status" AS ENUM('on_hand', 'awaiting_haul', 'in_transit', 'delivered');--> statement-breakpoint
CREATE TYPE "public"."tire_grade" AS ENUM('A', 'B', 'C', 'D', 'FAIL');--> statement-breakpoint
CREATE TYPE "public"."tire_status" AS ENUM('intake_review', 'in_stock', 'reserved', 'sold', 'scrapped', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('owner', 'manager', 'counter', 'intake');--> statement-breakpoint
CREATE TABLE "account_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"agent_id" uuid,
	"type" "alert_type" NOT NULL,
	"severity" integer DEFAULT 1 NOT NULL,
	"message" text NOT NULL,
	"status" "alert_status" DEFAULT 'open' NOT NULL,
	"acknowledged_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"shop_id" uuid NOT NULL,
	"signed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"signup_commission_paid" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commission_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"shop_id" uuid NOT NULL,
	"type" "commission_type" NOT NULL,
	"basis_cents" integer NOT NULL,
	"rate_applied_bps" integer,
	"amount_earned_cents" integer NOT NULL,
	"period" text NOT NULL,
	"paid_out_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commission_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"signup_rate" jsonb NOT NULL,
	"residual_rate_bps" integer NOT NULL,
	"residual_term" text DEFAULT 'life' NOT NULL,
	"upsell_rate_bps" integer DEFAULT 1000 NOT NULL,
	"upsell_attribution" text DEFAULT 'upseller' NOT NULL,
	"accelerators" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"email" text,
	"language" text DEFAULT 'en' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "demo_environments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_platform_user_id" uuid NOT NULL,
	"sandbox_shop_id" uuid,
	"seeded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_reset_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "destination_facilities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"state" text NOT NULL,
	"permit_number" text,
	"permit_expires_on" timestamp with time zone,
	"address_line1" text,
	"city" text,
	"postal_code" text,
	"permit_copy_url" text,
	"verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "disposal_fees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"state" text NOT NULL,
	"per_tire_cents" integer NOT NULL,
	"effective_from" timestamp with time zone NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "haulers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"state" text NOT NULL,
	"permit_number" text,
	"permit_expires_on" timestamp with time zone,
	"contact_name" text,
	"contact_phone" text,
	"contact_email" text,
	"truck_capacity" integer,
	"verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hauls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"hauler_id" uuid NOT NULL,
	"destination_facility_id" uuid NOT NULL,
	"status" "haul_status" DEFAULT 'scheduled' NOT NULL,
	"scheduled_for" timestamp with time zone,
	"picked_up_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"tire_count" integer DEFAULT 0 NOT NULL,
	"manifest_url" text,
	"nc_certification_url" text,
	"fee_cents" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "health_signals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"period" text NOT NULL,
	"login_frequency" integer,
	"intake_volume" integer,
	"sales_activity" integer,
	"days_since_last_activity" integer,
	"payment_status" text,
	"support_flags" integer,
	"computed_score" integer NOT NULL,
	"band" "health_band" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"type" text NOT NULL,
	"tire_id" uuid,
	"description" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_price_cents" integer NOT NULL,
	"total_cents" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"customer_id" uuid,
	"vehicle_id" uuid,
	"status" "invoice_status" DEFAULT 'draft' NOT NULL,
	"subtotal_cents" integer DEFAULT 0 NOT NULL,
	"tax_cents" integer DEFAULT 0 NOT NULL,
	"disposal_cents" integer DEFAULT 0 NOT NULL,
	"total_cents" integer DEFAULT 0 NOT NULL,
	"stripe_payment_intent_id" text,
	"stripe_charge_id" text,
	"payment_method" text,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "onboarding_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid,
	"agent_id" uuid,
	"step" "onboarding_step" DEFAULT 'details' NOT NULL,
	"email" text,
	"agreement_signed_at" timestamp with time zone,
	"agreement_pdf_url" text,
	"stripe_connect_status" text,
	"stripe_account_id" text,
	"data" jsonb,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "platform_role" NOT NULL,
	"language" text DEFAULT 'en' NOT NULL,
	"disabled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sale_docs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"tire_id" uuid NOT NULL,
	"language" text DEFAULT 'en' NOT NULL,
	"tread_photo_url" text,
	"sidewall_photo_url" text,
	"dot_code" text,
	"age_months" integer,
	"grade" "tire_grade",
	"age_disclosure_required" boolean DEFAULT false NOT NULL,
	"customer_signature_url" text,
	"signed_at" timestamp with time zone,
	"pdf_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales_agents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"platform_user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"territory" text,
	"goal_config" jsonb,
	"commission_plan_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scrap_tires" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"tire_id" uuid,
	"status" "scrap_status" DEFAULT 'on_hand' NOT NULL,
	"reason" text,
	"haul_id" uuid,
	"on_hand_since" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shops" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"state" text NOT NULL,
	"address_line1" text,
	"address_line2" text,
	"city" text,
	"postal_code" text,
	"timezone" text DEFAULT 'America/New_York' NOT NULL,
	"default_language" text DEFAULT 'en' NOT NULL,
	"stripe_account_id" text,
	"stripe_connect_status" text,
	"subscription_status" text DEFAULT 'trial' NOT NULL,
	"disposal_fee_cents" integer DEFAULT 300 NOT NULL,
	"pricing_floor_margin_bps" integer DEFAULT 2000 NOT NULL,
	"branding" jsonb,
	"health_score" integer,
	"health_band" "health_band",
	"health_updated_at" timestamp with time zone,
	"attributed_agent_id" uuid,
	"suspended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tires" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"brand" text,
	"model" text,
	"size" text NOT NULL,
	"dot_code" text,
	"dot_week" integer,
	"dot_year" integer,
	"load_index" text,
	"speed_rating" text,
	"tread_depth32nds" integer,
	"age_months" integer,
	"grade" "tire_grade",
	"grade_reason" jsonb,
	"vision_confidence" integer,
	"price_cents" integer,
	"cost_cents" integer,
	"benchmark_cents" integer,
	"status" "tire_status" DEFAULT 'intake_review' NOT NULL,
	"intake_photo_url" text,
	"sidewall_photo_url" text,
	"tread_photo_url" text,
	"source" text DEFAULT 'intake' NOT NULL,
	"wholesale_order_id" uuid,
	"intake_user_id" uuid,
	"sold_at" timestamp with time zone,
	"scrapped_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "user_role" NOT NULL,
	"language" text DEFAULT 'en' NOT NULL,
	"last_login_at" timestamp with time zone,
	"disabled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"vin" text,
	"plate" text,
	"year" integer,
	"make" text,
	"model" text,
	"oe_size" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wholesale_catalog" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"adapter" text NOT NULL,
	"external_id" text NOT NULL,
	"brand" text,
	"model" text,
	"size" text NOT NULL,
	"load_index" text,
	"speed_rating" text,
	"price_cents" integer,
	"in_stock" boolean DEFAULT true NOT NULL,
	"raw" jsonb,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wholesale_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"adapter" text NOT NULL,
	"external_order_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"total_cents" integer DEFAULT 0 NOT NULL,
	"raw" jsonb,
	"placed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account_alerts" ADD CONSTRAINT "account_alerts_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_alerts" ADD CONSTRAINT "account_alerts_agent_id_sales_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."sales_agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_accounts" ADD CONSTRAINT "agent_accounts_agent_id_sales_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."sales_agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_accounts" ADD CONSTRAINT "agent_accounts_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_events" ADD CONSTRAINT "commission_events_agent_id_sales_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."sales_agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_events" ADD CONSTRAINT "commission_events_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demo_environments" ADD CONSTRAINT "demo_environments_owner_platform_user_id_platform_users_id_fk" FOREIGN KEY ("owner_platform_user_id") REFERENCES "public"."platform_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demo_environments" ADD CONSTRAINT "demo_environments_sandbox_shop_id_shops_id_fk" FOREIGN KEY ("sandbox_shop_id") REFERENCES "public"."shops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hauls" ADD CONSTRAINT "hauls_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hauls" ADD CONSTRAINT "hauls_hauler_id_haulers_id_fk" FOREIGN KEY ("hauler_id") REFERENCES "public"."haulers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hauls" ADD CONSTRAINT "hauls_destination_facility_id_destination_facilities_id_fk" FOREIGN KEY ("destination_facility_id") REFERENCES "public"."destination_facilities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "health_signals" ADD CONSTRAINT "health_signals_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_tire_id_tires_id_fk" FOREIGN KEY ("tire_id") REFERENCES "public"."tires"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_sessions" ADD CONSTRAINT "onboarding_sessions_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_sessions" ADD CONSTRAINT "onboarding_sessions_agent_id_sales_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."sales_agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_docs" ADD CONSTRAINT "sale_docs_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_docs" ADD CONSTRAINT "sale_docs_tire_id_tires_id_fk" FOREIGN KEY ("tire_id") REFERENCES "public"."tires"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_agents" ADD CONSTRAINT "sales_agents_platform_user_id_platform_users_id_fk" FOREIGN KEY ("platform_user_id") REFERENCES "public"."platform_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scrap_tires" ADD CONSTRAINT "scrap_tires_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scrap_tires" ADD CONSTRAINT "scrap_tires_tire_id_tires_id_fk" FOREIGN KEY ("tire_id") REFERENCES "public"."tires"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tires" ADD CONSTRAINT "tires_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wholesale_orders" ADD CONSTRAINT "wholesale_orders_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "alerts_shop_status_idx" ON "account_alerts" USING btree ("shop_id","status");--> statement-breakpoint
CREATE INDEX "alerts_agent_status_idx" ON "account_alerts" USING btree ("agent_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_accounts_agent_shop_idx" ON "agent_accounts" USING btree ("agent_id","shop_id");--> statement-breakpoint
CREATE INDEX "agent_accounts_shop_idx" ON "agent_accounts" USING btree ("shop_id");--> statement-breakpoint
CREATE INDEX "commission_agent_period_idx" ON "commission_events" USING btree ("agent_id","period");--> statement-breakpoint
CREATE INDEX "commission_shop_idx" ON "commission_events" USING btree ("shop_id");--> statement-breakpoint
CREATE INDEX "customers_phone_idx" ON "customers" USING btree ("shop_id","phone");--> statement-breakpoint
CREATE UNIQUE INDEX "health_shop_period_idx" ON "health_signals" USING btree ("shop_id","period");--> statement-breakpoint
CREATE UNIQUE INDEX "platform_users_email_idx" ON "platform_users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "scrap_shop_status_idx" ON "scrap_tires" USING btree ("shop_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "shops_slug_idx" ON "shops" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "shops_agent_idx" ON "shops" USING btree ("attributed_agent_id");--> statement-breakpoint
CREATE INDEX "tires_shop_status_idx" ON "tires" USING btree ("shop_id","status");--> statement-breakpoint
CREATE INDEX "tires_size_idx" ON "tires" USING btree ("shop_id","size");--> statement-breakpoint
CREATE INDEX "tires_dot_idx" ON "tires" USING btree ("dot_code");--> statement-breakpoint
CREATE UNIQUE INDEX "users_shop_email_idx" ON "users" USING btree ("shop_id","email");--> statement-breakpoint
CREATE UNIQUE INDEX "wholesale_adapter_ext_idx" ON "wholesale_catalog" USING btree ("adapter","external_id");--> statement-breakpoint
CREATE INDEX "wholesale_size_idx" ON "wholesale_catalog" USING btree ("size");