import { cacheTag } from "next/cache";
import { asc, desc, eq, sql } from "drizzle-orm";

import { db, schema } from "@/db";

export type PlanListRow = {
  id: string;
  name: string;
  timezone: string;
  releasedSlug: string | null;
  createdAt: Date;
  updatedAt: Date;
  firstDate: string | null;
  lastDate: string | null;
  dayCount: number;
};

export type PlanRow = typeof schema.plans.$inferSelect;

export async function listPlans(): Promise<PlanListRow[]> {
  "use cache";
  cacheTag("plans:index");
  return db
    .select({
      id: schema.plans.id,
      name: schema.plans.name,
      timezone: schema.plans.timezone,
      releasedSlug: schema.plans.releasedSlug,
      createdAt: schema.plans.createdAt,
      updatedAt: schema.plans.updatedAt,
      firstDate: sql<string | null>`min(${schema.days.date})`.as("first_date"),
      lastDate: sql<string | null>`max(${schema.days.date})`.as("last_date"),
      dayCount: sql<number>`count(${schema.days.id})::int`.as("day_count"),
    })
    .from(schema.plans)
    .leftJoin(schema.days, eq(schema.days.planId, schema.plans.id))
    .groupBy(schema.plans.id)
    .orderBy(desc(schema.plans.updatedAt));
}

export async function getPlan(id: string): Promise<PlanRow | null> {
  "use cache";
  cacheTag(`plan:${id}`);
  const [row] = await db
    .select()
    .from(schema.plans)
    .where(eq(schema.plans.id, id))
    .limit(1);
  return row ?? null;
}

export type PlanSearchContext = {
  language: string;
  bias: { lat: number; lng: number } | null;
};

export async function getPlanSearchContext(
  planId: string,
): Promise<PlanSearchContext | null> {
  const [plan] = await db
    .select({ id: schema.plans.id, language: schema.plans.language })
    .from(schema.plans)
    .where(eq(schema.plans.id, planId))
    .limit(1);
  if (!plan) return null;

  const [lodging] = await db
    .select({ lat: schema.places.lat, lng: schema.places.lng })
    .from(schema.days)
    .innerJoin(
      schema.places,
      eq(schema.places.googlePlaceId, schema.days.startLodgingPlaceId),
    )
    .where(eq(schema.days.planId, planId))
    .orderBy(asc(schema.days.position))
    .limit(1);

  const bias =
    lodging && lodging.lat != null && lodging.lng != null
      ? { lat: lodging.lat, lng: lodging.lng }
      : null;

  return { language: plan.language, bias };
}
