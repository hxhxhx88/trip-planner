import {
  date,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  text,
  time,
  timestamp,
} from "drizzle-orm/pg-core";

import type { PlaceHours, PlacePhoto } from "@/lib/schemas";

export const plans = pgTable("plans", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  timezone: text("timezone").notNull(),
  releasedSlug: text("released_slug").unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const places = pgTable("places", {
  googlePlaceId: text("google_place_id").primaryKey(),
  name: text("name").notNull(),
  address: text("address"),
  lat: real("lat"),
  lng: real("lng"),
  photos: jsonb("photos").$type<PlacePhoto[]>().default([]).notNull(),
  hours: jsonb("hours").$type<PlaceHours | null>(),
  category: text("category"),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).defaultNow().notNull(),
});

export const days = pgTable("days", {
  id: text("id").primaryKey(),
  planId: text("plan_id")
    .notNull()
    .references(() => plans.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  startLodgingPlaceId: text("start_lodging_place_id").references(() => places.googlePlaceId),
  endLodgingPlaceId: text("end_lodging_place_id").references(() => places.googlePlaceId),
  position: integer("position").notNull(),
});

export const events = pgTable("events", {
  id: text("id").primaryKey(),
  dayId: text("day_id")
    .notNull()
    .references(() => days.id, { onDelete: "cascade" }),
  position: integer("position").notNull(),
  placeId: text("place_id").references(() => places.googlePlaceId),
  startTime: time("start_time"),
  stayDuration: integer("stay_duration"),
  description: text("description"),
  remark: text("remark"),
  lockedFields: jsonb("locked_fields").$type<string[]>().default([]).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const travels = pgTable("travels", {
  id: text("id").primaryKey(),
  dayId: text("day_id")
    .notNull()
    .references(() => days.id, { onDelete: "cascade" }),
  position: integer("position").notNull(),
  vehicle: text("vehicle"),
  travelTime: integer("travel_time"),
  routePath: jsonb("route_path").$type<[number, number][]>(),
  lockedFields: jsonb("locked_fields").$type<string[]>().default([]).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const planPlaceOverrides = pgTable(
  "plan_place_overrides",
  {
    planId: text("plan_id")
      .notNull()
      .references(() => plans.id, { onDelete: "cascade" }),
    placeId: text("place_id")
      .notNull()
      .references(() => places.googlePlaceId),
    hours: jsonb("hours").$type<PlaceHours>().notNull(),
  },
  (t) => [primaryKey({ columns: [t.planId, t.placeId] })],
);

export const placesCache = pgTable("places_cache", {
  googlePlaceId: text("google_place_id").primaryKey(),
  rawResponse: jsonb("raw_response").notNull(),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).defaultNow().notNull(),
});

export const directionsCache = pgTable(
  "directions_cache",
  {
    originPlaceId: text("origin_place_id").notNull(),
    destPlaceId: text("dest_place_id").notNull(),
    vehicle: text("vehicle").notNull(),
    travelTime: integer("travel_time").notNull(),
    routePath: jsonb("route_path").$type<[number, number][]>().notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.originPlaceId, t.destPlaceId, t.vehicle] })],
);
