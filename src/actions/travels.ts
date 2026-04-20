"use server";

import { updateTag } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db, schema } from "@/db";
import { err, ok, type Result, zodErr } from "@/lib/actions";
import { markPlanDirty } from "@/lib/plans/markDirty";
import { VehicleSchema } from "@/lib/schemas";

const PlanIdSchema = z.string().min(1);
const TravelIdSchema = z.string().min(1);

const TravelPatchSchema = z.object({
  vehicle: VehicleSchema.nullable().optional(),
});

const UpdateTravelInput = z.object({
  planId: PlanIdSchema,
  id: TravelIdSchema,
  expectedUpdatedAt: z.date(),
  patch: TravelPatchSchema,
});

export type UpdateTravelInputType = z.input<typeof UpdateTravelInput>;

export async function updateTravel(
  input: UpdateTravelInputType,
): Promise<Result<{ merged: boolean; updatedAt: Date }>> {
  const parsed = UpdateTravelInput.safeParse(input);
  if (!parsed.success) return err(zodErr(parsed.error));
  const { planId, id, expectedUpdatedAt, patch } = parsed.data;

  const dbPatch: Partial<typeof schema.travels.$inferInsert> = {};
  if ("vehicle" in patch) {
    dbPatch.vehicle = patch.vehicle ?? null;
    dbPatch.travelTime = null;
    dbPatch.routePath = null;
    dbPatch.transitSubtype = null;
  }

  const outcome = await db.transaction(async (tx) => {
    const [current] = await tx
      .select({
        updatedAt: schema.travels.updatedAt,
        lockedFields: schema.travels.lockedFields,
      })
      .from(schema.travels)
      .innerJoin(schema.days, eq(schema.travels.dayId, schema.days.id))
      .where(and(eq(schema.travels.id, id), eq(schema.days.planId, planId)))
      .limit(1);
    if (!current) return { kind: "not_found" as const };

    const merged =
      current.updatedAt.getTime() !== expectedUpdatedAt.getTime();
    const keys = Object.keys(patch);
    const locked = Array.from(new Set([...current.lockedFields, ...keys]));

    const [updated] = await tx
      .update(schema.travels)
      .set({ ...dbPatch, lockedFields: locked, updatedAt: new Date() })
      .where(eq(schema.travels.id, id))
      .returning({ updatedAt: schema.travels.updatedAt });

    return { kind: "ok" as const, merged, updatedAt: updated.updatedAt };
  });

  if (outcome.kind === "not_found") {
    return err({ code: "not_found", message: "Travel not found" });
  }

  await markPlanDirty(planId);
  updateTag(`plan:${planId}`);
  return ok({ merged: outcome.merged, updatedAt: outcome.updatedAt });
}
