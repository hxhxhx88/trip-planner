"use server";

import { updateTag } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db, schema } from "@/db";
import { err, ok, type Result, zodErr } from "@/lib/actions";
import { runAutoFillForPlan } from "@/lib/autofill/engine";
import type { Alert } from "@/lib/schemas";

const RunAutoFillInput = z.object({ planId: z.string().min(1) });
export type RunAutoFillInputType = z.input<typeof RunAutoFillInput>;

export async function runAutoFill(
  input: RunAutoFillInputType,
): Promise<Result<{ alerts: Alert[] }>> {
  const parsed = RunAutoFillInput.safeParse(input);
  if (!parsed.success) return err(zodErr(parsed.error));
  const { planId } = parsed.data;

  const { alerts } = await runAutoFillForPlan(planId);
  await db
    .update(schema.plans)
    .set({ dirtySince: null })
    .where(eq(schema.plans.id, planId));
  updateTag(`plan:${planId}`);
  return ok({ alerts });
}
