"use server";

import { updateTag } from "next/cache";
import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { db, schema } from "@/db";
import { err, ok, type Result, zodErr } from "@/lib/actions";
import { newSlug } from "@/lib/slug";

const PlanIdSchema = z.string().min(1);
const DayIdSchema = z.string().min(1);
const DateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const PlaceIdSchema = z.string().min(1);

const AddDayInput = z.object({ planId: PlanIdSchema, date: DateSchema });
const DeleteDayInput = z.object({ planId: PlanIdSchema, dayId: DayIdSchema });
const SetDayLodgingInput = z.object({
  planId: PlanIdSchema,
  dayId: DayIdSchema,
  slot: z.enum(["start", "end"]),
  placeId: PlaceIdSchema.nullable(),
});

export type AddDayInputType = z.input<typeof AddDayInput>;
export type DeleteDayInputType = z.input<typeof DeleteDayInput>;
export type SetDayLodgingInputType = z.input<typeof SetDayLodgingInput>;

export async function addDay(
  input: AddDayInputType,
): Promise<Result<{ id: string }>> {
  const parsed = AddDayInput.safeParse(input);
  if (!parsed.success) return err(zodErr(parsed.error));
  const { planId, date } = parsed.data;

  const outcome = await db.transaction(async (tx) => {
    const [planExists] = await tx
      .select({ id: schema.plans.id })
      .from(schema.plans)
      .where(eq(schema.plans.id, planId))
      .limit(1);
    if (!planExists) return { kind: "not_found" as const };

    const [dup] = await tx
      .select({ id: schema.days.id })
      .from(schema.days)
      .where(and(eq(schema.days.planId, planId), eq(schema.days.date, date)))
      .limit(1);
    if (dup) return { kind: "conflict" as const };

    const [latestWithLodging] = await tx
      .select({
        startLodgingPlaceId: schema.days.startLodgingPlaceId,
        endLodgingPlaceId: schema.days.endLodgingPlaceId,
      })
      .from(schema.days)
      .where(eq(schema.days.planId, planId))
      .orderBy(desc(schema.days.date))
      .limit(1);

    const id = newSlug();
    await tx.insert(schema.days).values({
      id,
      planId,
      date,
      position: 0,
      startLodgingPlaceId: latestWithLodging?.startLodgingPlaceId ?? null,
      endLodgingPlaceId: latestWithLodging?.endLodgingPlaceId ?? null,
    });

    const all = await tx
      .select({ id: schema.days.id })
      .from(schema.days)
      .where(eq(schema.days.planId, planId))
      .orderBy(asc(schema.days.date));
    for (let i = 0; i < all.length; i++) {
      await tx
        .update(schema.days)
        .set({ position: i })
        .where(eq(schema.days.id, all[i].id));
    }

    return { kind: "ok" as const, id };
  });

  if (outcome.kind === "not_found") {
    return err({ code: "not_found", message: "Plan not found" });
  }
  if (outcome.kind === "conflict") {
    return err({
      code: "conflict",
      message: "A day with this date already exists",
    });
  }

  updateTag(`plan:${planId}`);
  updateTag("plans:index");
  return ok({ id: outcome.id });
}

export async function deleteDay(
  input: DeleteDayInputType,
): Promise<Result> {
  const parsed = DeleteDayInput.safeParse(input);
  if (!parsed.success) return err(zodErr(parsed.error));
  const { planId, dayId } = parsed.data;

  const outcome = await db.transaction(async (tx) => {
    const res = await tx
      .delete(schema.days)
      .where(and(eq(schema.days.id, dayId), eq(schema.days.planId, planId)))
      .returning({ id: schema.days.id });
    if (res.length === 0) return { kind: "not_found" as const };

    const all = await tx
      .select({ id: schema.days.id })
      .from(schema.days)
      .where(eq(schema.days.planId, planId))
      .orderBy(asc(schema.days.date));
    for (let i = 0; i < all.length; i++) {
      await tx
        .update(schema.days)
        .set({ position: i })
        .where(eq(schema.days.id, all[i].id));
    }
    return { kind: "ok" as const };
  });

  if (outcome.kind === "not_found") {
    return err({ code: "not_found", message: "Day not found" });
  }

  updateTag(`plan:${planId}`);
  updateTag("plans:index");
  return ok();
}

export async function setDayLodging(
  input: SetDayLodgingInputType,
): Promise<Result> {
  const parsed = SetDayLodgingInput.safeParse(input);
  if (!parsed.success) return err(zodErr(parsed.error));
  const { planId, dayId, slot, placeId } = parsed.data;

  const patch =
    slot === "start"
      ? { startLodgingPlaceId: placeId }
      : { endLodgingPlaceId: placeId };

  const res = await db
    .update(schema.days)
    .set(patch)
    .where(and(eq(schema.days.id, dayId), eq(schema.days.planId, planId)))
    .returning({ id: schema.days.id });
  if (res.length === 0) {
    return err({ code: "not_found", message: "Day not found" });
  }

  updateTag(`plan:${planId}`);
  return ok();
}
