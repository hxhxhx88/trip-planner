"use server";

import { updateTag } from "next/cache";
import { eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { db, schema } from "@/db";
import { err, ok, type Result, zodErr } from "@/lib/actions";
import { newSlug } from "@/lib/slug";
import { rebaseTimesAcrossTz } from "@/lib/time";

const PlanIdSchema = z.string().min(1);
const NameSchema = z.string().trim().min(1).max(120);
const TzSchema = z.string().refine(
  (v) => {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: v });
      return true;
    } catch {
      return false;
    }
  },
  { message: "Invalid IANA timezone" },
);

const CreatePlanInput = z.object({
  name: NameSchema,
  timezone: TzSchema,
  tzSetByUser: z.boolean().optional(),
});
const RenamePlanInput = z.object({ id: PlanIdSchema, name: NameSchema });
const DuplicatePlanInput = z.object({ id: PlanIdSchema });
const DeletePlanInput = z.object({ id: PlanIdSchema });
const SetTimezoneInput = z.object({ id: PlanIdSchema, timezone: TzSchema });

export type CreatePlanInputType = z.input<typeof CreatePlanInput>;
export type RenamePlanInputType = z.input<typeof RenamePlanInput>;
export type DuplicatePlanInputType = z.input<typeof DuplicatePlanInput>;
export type DeletePlanInputType = z.input<typeof DeletePlanInput>;
export type SetTimezoneInputType = z.input<typeof SetTimezoneInput>;

export async function createPlan(
  input: CreatePlanInputType,
): Promise<Result<{ id: string }>> {
  const parsed = CreatePlanInput.safeParse(input);
  if (!parsed.success) return err(zodErr(parsed.error));

  const id = newSlug();
  await db.insert(schema.plans).values({
    id,
    name: parsed.data.name,
    timezone: parsed.data.timezone,
    tzSetByUser: parsed.data.tzSetByUser ?? false,
  });
  updateTag("plans:index");
  return ok({ id });
}

export async function renamePlan(input: RenamePlanInputType): Promise<Result> {
  const parsed = RenamePlanInput.safeParse(input);
  if (!parsed.success) return err(zodErr(parsed.error));

  const res = await db
    .update(schema.plans)
    .set({ name: parsed.data.name, updatedAt: new Date() })
    .where(eq(schema.plans.id, parsed.data.id))
    .returning({ id: schema.plans.id });
  if (res.length === 0) {
    return err({ code: "not_found", message: "Plan not found" });
  }
  updateTag("plans:index");
  updateTag(`plan:${parsed.data.id}`);
  return ok();
}

export async function setPlanTimezone(
  input: SetTimezoneInputType,
): Promise<Result> {
  const parsed = SetTimezoneInput.safeParse(input);
  if (!parsed.success) return err(zodErr(parsed.error));

  const { id, timezone: newTz } = parsed.data;

  const outcome = await db.transaction(async (tx) => {
    const [plan] = await tx
      .select()
      .from(schema.plans)
      .where(eq(schema.plans.id, id))
      .limit(1);
    if (!plan) return { notFound: true as const };

    if (plan.timezone !== newTz) {
      const rows = await tx
        .select({
          id: schema.events.id,
          startTime: schema.events.startTime,
          dayDate: schema.days.date,
        })
        .from(schema.events)
        .innerJoin(schema.days, eq(schema.days.id, schema.events.dayId))
        .where(eq(schema.days.planId, id));

      const patches = rebaseTimesAcrossTz(rows, plan.timezone, newTz);
      const now = new Date();
      for (const p of patches) {
        await tx
          .update(schema.events)
          .set({ startTime: p.startTime, updatedAt: now })
          .where(eq(schema.events.id, p.id));
      }
    }

    await tx
      .update(schema.plans)
      .set({ timezone: newTz, tzSetByUser: true, updatedAt: new Date() })
      .where(eq(schema.plans.id, id));
    return { notFound: false as const };
  });

  if (outcome.notFound) {
    return err({ code: "not_found", message: "Plan not found" });
  }
  updateTag("plans:index");
  updateTag(`plan:${id}`);
  return ok();
}

export async function duplicatePlan(
  input: DuplicatePlanInputType,
): Promise<Result<{ id: string }>> {
  const parsed = DuplicatePlanInput.safeParse(input);
  if (!parsed.success) return err(zodErr(parsed.error));
  const srcId = parsed.data.id;

  const outcome = await db.transaction(async (tx) => {
    const [src] = await tx
      .select()
      .from(schema.plans)
      .where(eq(schema.plans.id, srcId))
      .limit(1);
    if (!src) return { notFound: true as const };

    const newId = newSlug();
    await tx.insert(schema.plans).values({
      id: newId,
      name: `${src.name} (copy)`,
      timezone: src.timezone,
      tzSetByUser: src.tzSetByUser,
      releasedSlug: null,
    });

    const srcDays = await tx
      .select()
      .from(schema.days)
      .where(eq(schema.days.planId, srcId));

    const dayIdMap = new Map<string, string>();
    if (srcDays.length > 0) {
      const newDays = srcDays.map((d) => {
        const nid = newSlug();
        dayIdMap.set(d.id, nid);
        return { ...d, id: nid, planId: newId };
      });
      await tx.insert(schema.days).values(newDays);

      const srcDayIds = srcDays.map((d) => d.id);
      const [srcEvents, srcTravels] = await Promise.all([
        tx
          .select()
          .from(schema.events)
          .where(inArray(schema.events.dayId, srcDayIds)),
        tx
          .select()
          .from(schema.travels)
          .where(inArray(schema.travels.dayId, srcDayIds)),
      ]);
      if (srcEvents.length > 0) {
        await tx.insert(schema.events).values(
          srcEvents.map((e) => ({
            ...e,
            id: newSlug(),
            dayId: dayIdMap.get(e.dayId)!,
          })),
        );
      }
      if (srcTravels.length > 0) {
        await tx.insert(schema.travels).values(
          srcTravels.map((t) => ({
            ...t,
            id: newSlug(),
            dayId: dayIdMap.get(t.dayId)!,
          })),
        );
      }
    }

    const overrides = await tx
      .select()
      .from(schema.planPlaceOverrides)
      .where(eq(schema.planPlaceOverrides.planId, srcId));
    if (overrides.length > 0) {
      await tx
        .insert(schema.planPlaceOverrides)
        .values(overrides.map((o) => ({ ...o, planId: newId })));
    }

    return { notFound: false as const, newId };
  });

  if (outcome.notFound) {
    return err({ code: "not_found", message: "Plan not found" });
  }
  updateTag("plans:index");
  return ok({ id: outcome.newId });
}

export async function deletePlan(input: DeletePlanInputType): Promise<Result> {
  const parsed = DeletePlanInput.safeParse(input);
  if (!parsed.success) return err(zodErr(parsed.error));

  const res = await db
    .delete(schema.plans)
    .where(eq(schema.plans.id, parsed.data.id))
    .returning({ id: schema.plans.id });
  if (res.length === 0) {
    return err({ code: "not_found", message: "Plan not found" });
  }
  updateTag("plans:index");
  updateTag(`plan:${parsed.data.id}`);
  return ok();
}
