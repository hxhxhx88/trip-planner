import { cacheTag } from "next/cache";
import { and, asc, eq, inArray } from "drizzle-orm";

import { db, schema } from "@/db";
import type { PlaceHours, PlacePhoto, TransitSubtype } from "@/lib/schemas";
import { denormalizeTime } from "@/lib/time";

export type PlanForEditor = {
  plan: {
    id: string;
    name: string;
    timezone: string;
    language: string;
    releasedSlug: string | null;
  };
  days: Array<{
    id: string;
    date: string;
    position: number;
    startLodgingPlaceId: string | null;
    endLodgingPlaceId: string | null;
  }>;
  events: Array<{
    id: string;
    dayId: string;
    position: number;
    placeId: string | null;
    startTime: string | null;
    stayDuration: number | null;
    description: string | null;
    remark: string | null;
    lockedFields: string[];
    updatedAt: Date;
  }>;
  travels: Array<{
    id: string;
    dayId: string;
    position: number;
    vehicle: string | null;
    travelTime: number | null;
    transitSubtype: TransitSubtype | null;
    routePath: [number, number][] | null;
    lockedFields: string[];
    updatedAt: Date;
  }>;
  places: Record<
    string,
    {
      googlePlaceId: string;
      name: string;
      address: string | null;
      lat: number | null;
      lng: number | null;
      category: string | null;
      photos: PlacePhoto[];
      hours: PlaceHours | null;
      hoursSource: "google" | "override";
    }
  >;
};

export async function getPlanForEditor(
  planId: string,
): Promise<PlanForEditor | null> {
  "use cache";
  cacheTag(`plan:${planId}`);
  cacheTag("plans:index");
  return loadPlanForEditor(planId);
}

export async function loadPlanForEditor(
  planId: string,
): Promise<PlanForEditor | null> {
  const [plan] = await db
    .select()
    .from(schema.plans)
    .where(eq(schema.plans.id, planId))
    .limit(1);
  if (!plan) return null;

  const days = await db
    .select()
    .from(schema.days)
    .where(eq(schema.days.planId, planId))
    .orderBy(asc(schema.days.date));

  const dayIds = days.map((d) => d.id);
  const [eventsRows, travelsRows] = await Promise.all([
    dayIds.length > 0
      ? db
          .select()
          .from(schema.events)
          .where(inArray(schema.events.dayId, dayIds))
      : Promise.resolve([] as (typeof schema.events.$inferSelect)[]),
    dayIds.length > 0
      ? db
          .select()
          .from(schema.travels)
          .where(inArray(schema.travels.dayId, dayIds))
      : Promise.resolve([] as (typeof schema.travels.$inferSelect)[]),
  ]);

  const placeIds = new Set<string>();
  for (const d of days) {
    if (d.startLodgingPlaceId) placeIds.add(d.startLodgingPlaceId);
    if (d.endLodgingPlaceId) placeIds.add(d.endLodgingPlaceId);
  }
  for (const e of eventsRows) {
    if (e.placeId) placeIds.add(e.placeId);
  }

  const placesRows =
    placeIds.size > 0
      ? await db
          .select({
            googlePlaceId: schema.places.googlePlaceId,
            name: schema.places.name,
            address: schema.places.address,
            lat: schema.places.lat,
            lng: schema.places.lng,
            category: schema.places.category,
            photos: schema.places.photos,
            hours: schema.places.hours,
            overrideHours: schema.planPlaceOverrides.hours,
          })
          .from(schema.places)
          .leftJoin(
            schema.planPlaceOverrides,
            and(
              eq(schema.planPlaceOverrides.placeId, schema.places.googlePlaceId),
              eq(schema.planPlaceOverrides.planId, planId),
            ),
          )
          .where(inArray(schema.places.googlePlaceId, [...placeIds]))
      : [];

  const places: PlanForEditor["places"] = {};
  for (const p of placesRows) {
    const hasOverride = p.overrideHours !== null;
    places[p.googlePlaceId] = {
      googlePlaceId: p.googlePlaceId,
      name: p.name,
      address: p.address,
      lat: p.lat,
      lng: p.lng,
      category: p.category,
      photos: p.photos,
      hours: hasOverride ? p.overrideHours : (p.hours ?? null),
      hoursSource: hasOverride ? "override" : "google",
    };
  }

  return {
    plan: {
      id: plan.id,
      name: plan.name,
      timezone: plan.timezone,
      language: plan.language,
      releasedSlug: plan.releasedSlug,
    },
    days: days.map((d) => ({
      id: d.id,
      date: d.date,
      position: d.position,
      startLodgingPlaceId: d.startLodgingPlaceId,
      endLodgingPlaceId: d.endLodgingPlaceId,
    })),
    events: eventsRows
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((e) => ({
        id: e.id,
        dayId: e.dayId,
        position: e.position,
        placeId: e.placeId,
        startTime: e.startTime ? denormalizeTime(e.startTime) : null,
        stayDuration: e.stayDuration,
        description: e.description,
        remark: e.remark,
        lockedFields: e.lockedFields,
        updatedAt: e.updatedAt,
      })),
    travels: travelsRows
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((t) => ({
        id: t.id,
        dayId: t.dayId,
        position: t.position,
        vehicle: t.vehicle,
        travelTime: t.travelTime,
        transitSubtype: (t.transitSubtype as TransitSubtype | null) ?? null,
        routePath: t.routePath,
        lockedFields: t.lockedFields,
        updatedAt: t.updatedAt,
      })),
    places,
  };
}
