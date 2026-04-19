import { updateTag } from "next/cache";
import { eq } from "drizzle-orm";

import { db, schema } from "@/db";
import { inferTimezone } from "@/lib/geo/inferTz";
import { rebaseTimesAcrossTz } from "@/lib/time";

export async function maybeInferTimezone(
  planId: string,
  placeId: string,
): Promise<void> {
  try {
    const [plan] = await db
      .select({
        id: schema.plans.id,
        timezone: schema.plans.timezone,
        tzSetByUser: schema.plans.tzSetByUser,
      })
      .from(schema.plans)
      .where(eq(schema.plans.id, planId))
      .limit(1);
    if (!plan || plan.tzSetByUser) return;

    const [place] = await db
      .select({
        lat: schema.places.lat,
        lng: schema.places.lng,
      })
      .from(schema.places)
      .where(eq(schema.places.googlePlaceId, placeId))
      .limit(1);
    if (!place || place.lat == null || place.lng == null) return;

    const newTz = inferTimezone(place.lat, place.lng);
    if (!newTz || newTz === plan.timezone) {
      if (newTz === plan.timezone) {
        await db
          .update(schema.plans)
          .set({ tzSetByUser: true })
          .where(eq(schema.plans.id, planId));
        updateTag(`plan:${planId}`);
      }
      return;
    }

    await db.transaction(async (tx) => {
      const [fresh] = await tx
        .select({
          timezone: schema.plans.timezone,
          tzSetByUser: schema.plans.tzSetByUser,
        })
        .from(schema.plans)
        .where(eq(schema.plans.id, planId))
        .limit(1);
      if (!fresh || fresh.tzSetByUser) return;

      const rows = await tx
        .select({
          id: schema.events.id,
          startTime: schema.events.startTime,
          dayDate: schema.days.date,
        })
        .from(schema.events)
        .innerJoin(schema.days, eq(schema.days.id, schema.events.dayId))
        .where(eq(schema.days.planId, planId));

      const patches = rebaseTimesAcrossTz(rows, fresh.timezone, newTz);
      const now = new Date();
      for (const p of patches) {
        await tx
          .update(schema.events)
          .set({ startTime: p.startTime, updatedAt: now })
          .where(eq(schema.events.id, p.id));
      }

      await tx
        .update(schema.plans)
        .set({ timezone: newTz, tzSetByUser: true, updatedAt: now })
        .where(eq(schema.plans.id, planId));
    });

    updateTag(`plan:${planId}`);
    updateTag("plans:index");
  } catch (e) {
    console.error("[maybeInferTimezone] failed", planId, placeId, e);
  }
}
