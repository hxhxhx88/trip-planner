"use server";

import { updateTag } from "next/cache";
import { and, asc, desc, eq, gt, lt } from "drizzle-orm";
import { z } from "zod";

import { db, schema } from "@/db";
import { err, ok, type Result, zodErr } from "@/lib/actions";
import { markPlanDirty } from "@/lib/plans/markDirty";
import { TimeHHMMSchema } from "@/lib/schemas";
import { newSlug } from "@/lib/slug";
import { normalizeTime } from "@/lib/time";

const PlanIdSchema = z.string().min(1);
const DayIdSchema = z.string().min(1);
const EventIdSchema = z.string().min(1);

const EventPatchSchema = z.object({
  placeId: z.string().min(1).nullable().optional(),
  startTime: TimeHHMMSchema.nullable().optional(),
  stayDuration: z.number().int().min(0).nullable().optional(),
  description: z.string().nullable().optional(),
  remark: z.string().nullable().optional(),
});

const AddEventInput = z.object({
  planId: PlanIdSchema,
  dayId: DayIdSchema,
});

const UpdateEventInput = z.object({
  planId: PlanIdSchema,
  id: EventIdSchema,
  expectedUpdatedAt: z.date(),
  patch: EventPatchSchema,
});

const RemoveEventInput = z.object({
  planId: PlanIdSchema,
  id: EventIdSchema,
});

const MoveEventInput = z.object({
  planId: PlanIdSchema,
  id: EventIdSchema,
  direction: z.enum(["up", "down"]),
});

export type AddEventInputType = z.input<typeof AddEventInput>;
export type UpdateEventInputType = z.input<typeof UpdateEventInput>;
export type RemoveEventInputType = z.input<typeof RemoveEventInput>;
export type MoveEventInputType = z.input<typeof MoveEventInput>;

export async function addEvent(
  input: AddEventInputType,
): Promise<Result<{ id: string }>> {
  const parsed = AddEventInput.safeParse(input);
  if (!parsed.success) return err(zodErr(parsed.error));
  const { planId, dayId } = parsed.data;

  const outcome = await db.transaction(async (tx) => {
    const [day] = await tx
      .select({ id: schema.days.id })
      .from(schema.days)
      .where(and(eq(schema.days.id, dayId), eq(schema.days.planId, planId)))
      .limit(1);
    if (!day) return { kind: "not_found" as const };

    const [lastEvent] = await tx
      .select({ position: schema.events.position })
      .from(schema.events)
      .where(eq(schema.events.dayId, dayId))
      .orderBy(desc(schema.events.position))
      .limit(1);

    const id = newSlug();
    if (!lastEvent) {
      await tx.insert(schema.events).values({
        id,
        dayId,
        position: 100,
        lockedFields: [],
      });
      await tx.insert(schema.travels).values([
        { id: newSlug(), dayId, position: 50, lockedFields: [] },
        { id: newSlug(), dayId, position: 150, lockedFields: [] },
      ]);
    } else {
      const newPos = lastEvent.position + 100;
      await tx.insert(schema.events).values({
        id,
        dayId,
        position: newPos,
        lockedFields: [],
      });
      await tx.insert(schema.travels).values({
        id: newSlug(),
        dayId,
        position: newPos + 50,
        lockedFields: [],
      });
    }

    return { kind: "ok" as const, id };
  });

  if (outcome.kind === "not_found") {
    return err({ code: "not_found", message: "Day not found" });
  }

  await markPlanDirty(planId);
  updateTag(`plan:${planId}`);
  return ok({ id: outcome.id });
}

export async function updateEvent(
  input: UpdateEventInputType,
): Promise<Result<{ merged: boolean; updatedAt: Date }>> {
  const parsed = UpdateEventInput.safeParse(input);
  if (!parsed.success) return err(zodErr(parsed.error));
  const { planId, id, expectedUpdatedAt, patch } = parsed.data;

  const dbPatch: Partial<typeof schema.events.$inferInsert> = {};
  if ("placeId" in patch) dbPatch.placeId = patch.placeId ?? null;
  if ("startTime" in patch) {
    dbPatch.startTime = patch.startTime ? normalizeTime(patch.startTime) : null;
  }
  if ("stayDuration" in patch)
    dbPatch.stayDuration = patch.stayDuration ?? null;
  if ("description" in patch) dbPatch.description = patch.description ?? null;
  if ("remark" in patch) dbPatch.remark = patch.remark ?? null;

  const outcome = await db.transaction(async (tx) => {
    const [current] = await tx
      .select({
        updatedAt: schema.events.updatedAt,
        lockedFields: schema.events.lockedFields,
      })
      .from(schema.events)
      .innerJoin(schema.days, eq(schema.events.dayId, schema.days.id))
      .where(and(eq(schema.events.id, id), eq(schema.days.planId, planId)))
      .limit(1);
    if (!current) return { kind: "not_found" as const };

    const merged =
      current.updatedAt.getTime() !== expectedUpdatedAt.getTime();
    const keys = Object.keys(patch);
    const locked = Array.from(new Set([...current.lockedFields, ...keys]));

    const [updated] = await tx
      .update(schema.events)
      .set({ ...dbPatch, lockedFields: locked, updatedAt: new Date() })
      .where(eq(schema.events.id, id))
      .returning({ updatedAt: schema.events.updatedAt });

    return { kind: "ok" as const, merged, updatedAt: updated.updatedAt };
  });

  if (outcome.kind === "not_found") {
    return err({ code: "not_found", message: "Event not found" });
  }

  await markPlanDirty(planId);
  updateTag(`plan:${planId}`);
  return ok({ merged: outcome.merged, updatedAt: outcome.updatedAt });
}

export async function removeEvent(
  input: RemoveEventInputType,
): Promise<Result> {
  const parsed = RemoveEventInput.safeParse(input);
  if (!parsed.success) return err(zodErr(parsed.error));
  const { planId, id } = parsed.data;

  const outcome = await db.transaction(async (tx) => {
    const [evt] = await tx
      .select({
        id: schema.events.id,
        dayId: schema.events.dayId,
        position: schema.events.position,
      })
      .from(schema.events)
      .innerJoin(schema.days, eq(schema.events.dayId, schema.days.id))
      .where(and(eq(schema.events.id, id), eq(schema.days.planId, planId)))
      .limit(1);
    if (!evt) return { kind: "not_found" as const };

    const [afterTravel] = await tx
      .select({ id: schema.travels.id })
      .from(schema.travels)
      .where(
        and(
          eq(schema.travels.dayId, evt.dayId),
          gt(schema.travels.position, evt.position),
        ),
      )
      .orderBy(asc(schema.travels.position))
      .limit(1);

    await tx.delete(schema.events).where(eq(schema.events.id, id));
    if (afterTravel) {
      await tx
        .delete(schema.travels)
        .where(eq(schema.travels.id, afterTravel.id));
    }

    const remaining = await tx
      .select({ id: schema.events.id })
      .from(schema.events)
      .where(eq(schema.events.dayId, evt.dayId))
      .limit(1);
    if (remaining.length === 0) {
      await tx
        .delete(schema.travels)
        .where(eq(schema.travels.dayId, evt.dayId));
    }

    return { kind: "ok" as const };
  });

  if (outcome.kind === "not_found") {
    return err({ code: "not_found", message: "Event not found" });
  }

  await markPlanDirty(planId);
  updateTag(`plan:${planId}`);
  return ok();
}

export async function moveEvent(input: MoveEventInputType): Promise<Result> {
  const parsed = MoveEventInput.safeParse(input);
  if (!parsed.success) return err(zodErr(parsed.error));
  const { planId, id, direction } = parsed.data;

  const outcome = await db.transaction(async (tx) => {
    const [evt] = await tx
      .select({
        id: schema.events.id,
        dayId: schema.events.dayId,
        position: schema.events.position,
      })
      .from(schema.events)
      .innerJoin(schema.days, eq(schema.events.dayId, schema.days.id))
      .where(and(eq(schema.events.id, id), eq(schema.days.planId, planId)))
      .limit(1);
    if (!evt) return { kind: "not_found" as const };

    const neighborQuery = tx
      .select({ id: schema.events.id, position: schema.events.position })
      .from(schema.events);

    const [neighbor] =
      direction === "up"
        ? await neighborQuery
            .where(
              and(
                eq(schema.events.dayId, evt.dayId),
                lt(schema.events.position, evt.position),
              ),
            )
            .orderBy(desc(schema.events.position))
            .limit(1)
        : await neighborQuery
            .where(
              and(
                eq(schema.events.dayId, evt.dayId),
                gt(schema.events.position, evt.position),
              ),
            )
            .orderBy(asc(schema.events.position))
            .limit(1);

    if (!neighbor) return { kind: "noop" as const };

    await tx
      .update(schema.events)
      .set({ position: evt.position })
      .where(eq(schema.events.id, neighbor.id));
    await tx
      .update(schema.events)
      .set({ position: neighbor.position })
      .where(eq(schema.events.id, evt.id));

    return { kind: "ok" as const };
  });

  if (outcome.kind === "not_found") {
    return err({ code: "not_found", message: "Event not found" });
  }

  await markPlanDirty(planId);
  updateTag(`plan:${planId}`);
  return ok();
}
