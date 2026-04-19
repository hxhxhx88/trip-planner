"use server";

import { updateTag } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db, schema } from "@/db";
import { err, ok, type Result, zodErr } from "@/lib/actions";
import { newSlug } from "@/lib/slug";

const PlanIdInput = z.object({ planId: z.string().min(1) });
export type ReleasePlanInputType = z.input<typeof PlanIdInput>;
export type UnreleasePlanInputType = z.input<typeof PlanIdInput>;

export async function releasePlan(
  input: ReleasePlanInputType,
): Promise<Result<{ slug: string }>> {
  const parsed = PlanIdInput.safeParse(input);
  if (!parsed.success) return err(zodErr(parsed.error));
  const { planId } = parsed.data;

  const [existing] = await db
    .select({ releasedSlug: schema.plans.releasedSlug })
    .from(schema.plans)
    .where(eq(schema.plans.id, planId))
    .limit(1);
  if (!existing) return err({ code: "not_found", message: "Plan not found" });
  if (existing.releasedSlug) return ok({ slug: existing.releasedSlug });

  let slug = newSlug();
  for (let i = 0; i < 5; i++) {
    try {
      await db
        .update(schema.plans)
        .set({ releasedSlug: slug, updatedAt: new Date() })
        .where(eq(schema.plans.id, planId));
      break;
    } catch (e) {
      if (i === 4) throw e;
      slug = newSlug();
    }
  }

  updateTag(`plan:${planId}`);
  updateTag("plans:index");
  return ok({ slug });
}

export async function unreleasePlan(
  input: UnreleasePlanInputType,
): Promise<Result> {
  const parsed = PlanIdInput.safeParse(input);
  if (!parsed.success) return err(zodErr(parsed.error));
  const { planId } = parsed.data;

  const [existing] = await db
    .select({ releasedSlug: schema.plans.releasedSlug })
    .from(schema.plans)
    .where(eq(schema.plans.id, planId))
    .limit(1);
  if (!existing) return err({ code: "not_found", message: "Plan not found" });
  if (!existing.releasedSlug) return ok();

  const oldSlug = existing.releasedSlug;
  await db
    .update(schema.plans)
    .set({ releasedSlug: null, updatedAt: new Date() })
    .where(eq(schema.plans.id, planId));
  updateTag(`plan:${planId}`);
  updateTag(`release:${oldSlug}`);
  updateTag("plans:index");
  return ok();
}
