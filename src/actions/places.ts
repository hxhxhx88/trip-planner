"use server";

import { updateTag } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { db, schema } from "@/db";
import { err, ok, type Result, zodErr } from "@/lib/actions";

const PlanIdSchema = z.string().min(1);
const PlaceIdSchema = z.string().min(1);
const HHMMSchema = z.string().regex(/^\d{2}:\d{2}$/);

const WeeklyHoursSchema = z.object({
  weekday: z.union([
    z.literal(0),
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
    z.literal(6),
  ]),
  open: HHMMSchema,
  close: HHMMSchema,
});

const HoursExceptionSchema = z.object({
  date: z.string(),
  open: HHMMSchema.optional(),
  close: HHMMSchema.optional(),
  closed: z.boolean().optional(),
});

const PlaceHoursSchema = z.object({
  weekly: z.array(WeeklyHoursSchema),
  exceptions: z.array(HoursExceptionSchema).optional(),
});

const SetHoursOverrideInput = z.object({
  planId: PlanIdSchema,
  placeId: PlaceIdSchema,
  hours: PlaceHoursSchema,
});

const ClearHoursOverrideInput = z.object({
  planId: PlanIdSchema,
  placeId: PlaceIdSchema,
});

export type SetHoursOverrideInputType = z.input<typeof SetHoursOverrideInput>;
export type ClearHoursOverrideInputType = z.input<typeof ClearHoursOverrideInput>;

export async function setHoursOverride(
  input: SetHoursOverrideInputType,
): Promise<Result> {
  const parsed = SetHoursOverrideInput.safeParse(input);
  if (!parsed.success) return err(zodErr(parsed.error));
  const { planId, placeId, hours } = parsed.data;

  await db
    .insert(schema.planPlaceOverrides)
    .values({ planId, placeId, hours })
    .onConflictDoUpdate({
      target: [
        schema.planPlaceOverrides.planId,
        schema.planPlaceOverrides.placeId,
      ],
      set: { hours: sql`excluded.hours` },
    });

  updateTag(`plan:${planId}`);
  return ok();
}

export async function clearHoursOverride(
  input: ClearHoursOverrideInputType,
): Promise<Result> {
  const parsed = ClearHoursOverrideInput.safeParse(input);
  if (!parsed.success) return err(zodErr(parsed.error));
  const { planId, placeId } = parsed.data;

  await db
    .delete(schema.planPlaceOverrides)
    .where(
      and(
        eq(schema.planPlaceOverrides.planId, planId),
        eq(schema.planPlaceOverrides.placeId, placeId),
      ),
    );

  updateTag(`plan:${planId}`);
  return ok();
}
