import { cacheTag } from "next/cache";
import { eq } from "drizzle-orm";

import { db, schema } from "@/db";
import { getPlanForEditor, type PlanForEditor } from "@/lib/model/plan";

export async function getPlanIdBySlug(slug: string): Promise<string | null> {
  "use cache";
  cacheTag(`release:${slug}`);
  const [row] = await db
    .select({ id: schema.plans.id })
    .from(schema.plans)
    .where(eq(schema.plans.releasedSlug, slug))
    .limit(1);
  return row?.id ?? null;
}

export async function getPlanForReleased(
  planId: string,
): Promise<PlanForEditor | null> {
  return getPlanForEditor(planId);
}
