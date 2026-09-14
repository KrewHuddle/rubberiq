CREATE TABLE "dispatch_routes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hauler_id" uuid NOT NULL,
	"destination_facility_id" uuid NOT NULL,
	"status" "haul_status" DEFAULT 'scheduled' NOT NULL,
	"capacity" integer NOT NULL,
	"planned_tire_count" integer DEFAULT 0 NOT NULL,
	"stop_count" integer DEFAULT 0 NOT NULL,
	"state" text,
	"scheduled_for" timestamp with time zone,
	"created_by_platform_user_id" uuid,
	"collected_cents" integer DEFAULT 0 NOT NULL,
	"haul_cost_cents" integer DEFAULT 0 NOT NULL,
	"margin_cents" integer,
	"reconciled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "hauls" ADD COLUMN "route_id" uuid;--> statement-breakpoint
ALTER TABLE "hauls" ADD COLUMN "collected_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "hauls" ADD COLUMN "margin_cents" integer;--> statement-breakpoint
ALTER TABLE "hauls" ADD COLUMN "reconciled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "dispatch_routes" ADD CONSTRAINT "dispatch_routes_hauler_id_haulers_id_fk" FOREIGN KEY ("hauler_id") REFERENCES "public"."haulers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispatch_routes" ADD CONSTRAINT "dispatch_routes_destination_facility_id_destination_facilities_id_fk" FOREIGN KEY ("destination_facility_id") REFERENCES "public"."destination_facilities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dispatch_routes_status_idx" ON "dispatch_routes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "dispatch_routes_hauler_idx" ON "dispatch_routes" USING btree ("hauler_id");