import { eq } from "drizzle-orm";

import { db, schema } from "@/db";
import { cascade } from "@/lib/cascade";
import { loadPlanForEditor, type PlanForEditor } from "@/lib/model/plan";
import type { Alert } from "@/lib/schemas";
import { normalizeTime } from "@/lib/time";
import { dedupeAlerts, validate } from "@/lib/validate";

import { backfillDay, type RouteFailure } from "./backfill";
import type { EventUpdate, ResolvedDay } from "./types";

export async function runAutoFillForPlan(
  planId: string,
): Promise<{ alerts: Alert[] }> {
  const initial = await loadPlanForEditor(planId);
  if (!initial) {
    return {
      alerts: [
        {
          severity: "issue",
          code: "cascade_unresolved",
          entity: { type: "plan", id: planId },
          message: "Plan not found",
        },
      ],
    };
  }

  const routeFailures: RouteFailure[] = [];
  for (const day of initial.days) {
    const resolved = resolveDay(initial, day.id);
    const { routeFailures: failed } = await backfillDay(
      resolved,
      initial.plan.language,
    );
    routeFailures.push(...failed);
  }

  const refreshed = await loadPlanForEditor(planId);
  if (!refreshed) {
    return {
      alerts: [
        {
          severity: "issue",
          code: "cascade_unresolved",
          entity: { type: "plan", id: planId },
          message: "Plan not found after backfill",
        },
      ],
    };
  }

  const cascadeAlerts: Alert[] = [];
  for (const day of refreshed.days) {
    const resolved = resolveDay(refreshed, day.id);
    const { events, alerts } = cascade(resolved);
    cascadeAlerts.push(...alerts);
    await persistEventUpdates(events, resolved.events);
  }

  const final = await loadPlanForEditor(planId);
  const validateAlerts = final ? validate(final) : [];

  const failureAlerts: Alert[] = routeFailures.map(({ travelId, reason }) => ({
    severity: "issue",
    code: "cascade_unresolved",
    entity: { type: "travel", id: travelId },
    message: `Route unavailable (${reason}); travel time not computed`,
  }));

  const alerts = dedupeAlerts([
    ...failureAlerts,
    ...cascadeAlerts,
    ...validateAlerts,
  ]);

  return { alerts };
}

function resolveDay(plan: PlanForEditor, dayId: string): ResolvedDay {
  const day = plan.days.find((d) => d.id === dayId);
  if (!day) throw new Error(`day ${dayId} not found in plan`);
  return {
    day,
    events: plan.events
      .filter((e) => e.dayId === dayId)
      .sort((a, b) => a.position - b.position),
    travels: plan.travels
      .filter((t) => t.dayId === dayId)
      .sort((a, b) => a.position - b.position),
    places: plan.places,
  };
}

async function persistEventUpdates(
  updates: EventUpdate[],
  dayEvents: PlanForEditor["events"],
): Promise<void> {
  const byId = new Map(dayEvents.map((e) => [e.id, e]));

  for (const update of updates) {
    const existing = byId.get(update.id);
    if (!existing) continue;

    const patch: Partial<typeof schema.events.$inferInsert> = {};
    if (
      update.startTime != null &&
      !existing.lockedFields.includes("startTime")
    ) {
      patch.startTime = normalizeTime(update.startTime);
    }
    if (
      update.stayDuration != null &&
      !existing.lockedFields.includes("stayDuration")
    ) {
      patch.stayDuration = update.stayDuration;
    }
    if (
      update.description != null &&
      !existing.lockedFields.includes("description")
    ) {
      patch.description = update.description;
    }

    if (Object.keys(patch).length === 0) continue;
    patch.updatedAt = new Date();
    await db
      .update(schema.events)
      .set(patch)
      .where(eq(schema.events.id, update.id));
  }
}
