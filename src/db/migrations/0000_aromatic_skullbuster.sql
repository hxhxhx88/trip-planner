CREATE TABLE "days" (
	"id" text PRIMARY KEY NOT NULL,
	"plan_id" text NOT NULL,
	"date" date NOT NULL,
	"start_lodging_place_id" text,
	"end_lodging_place_id" text,
	"position" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "directions_cache" (
	"origin_place_id" text NOT NULL,
	"dest_place_id" text NOT NULL,
	"vehicle" text NOT NULL,
	"travel_time" integer NOT NULL,
	"route_path" jsonb NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "directions_cache_origin_place_id_dest_place_id_vehicle_pk" PRIMARY KEY("origin_place_id","dest_place_id","vehicle")
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" text PRIMARY KEY NOT NULL,
	"day_id" text NOT NULL,
	"position" integer NOT NULL,
	"place_id" text,
	"start_time" time,
	"stay_duration" integer,
	"description" text,
	"remark" text,
	"locked_fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "places" (
	"google_place_id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"lat" real,
	"lng" real,
	"photos" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"hours" jsonb,
	"category" text,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "places_cache" (
	"google_place_id" text PRIMARY KEY NOT NULL,
	"raw_response" jsonb NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plan_place_overrides" (
	"plan_id" text NOT NULL,
	"place_id" text NOT NULL,
	"hours" jsonb NOT NULL,
	CONSTRAINT "plan_place_overrides_plan_id_place_id_pk" PRIMARY KEY("plan_id","place_id")
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"timezone" text NOT NULL,
	"released_slug" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plans_released_slug_unique" UNIQUE("released_slug")
);
--> statement-breakpoint
CREATE TABLE "travels" (
	"id" text PRIMARY KEY NOT NULL,
	"day_id" text NOT NULL,
	"position" integer NOT NULL,
	"vehicle" text,
	"travel_time" integer,
	"route_path" jsonb,
	"locked_fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "days" ADD CONSTRAINT "days_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "days" ADD CONSTRAINT "days_start_lodging_place_id_places_google_place_id_fk" FOREIGN KEY ("start_lodging_place_id") REFERENCES "public"."places"("google_place_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "days" ADD CONSTRAINT "days_end_lodging_place_id_places_google_place_id_fk" FOREIGN KEY ("end_lodging_place_id") REFERENCES "public"."places"("google_place_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_day_id_days_id_fk" FOREIGN KEY ("day_id") REFERENCES "public"."days"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_place_id_places_google_place_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("google_place_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_place_overrides" ADD CONSTRAINT "plan_place_overrides_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_place_overrides" ADD CONSTRAINT "plan_place_overrides_place_id_places_google_place_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("google_place_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "travels" ADD CONSTRAINT "travels_day_id_days_id_fk" FOREIGN KEY ("day_id") REFERENCES "public"."days"("id") ON DELETE cascade ON UPDATE no action;