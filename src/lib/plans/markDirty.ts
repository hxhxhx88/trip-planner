import { eq } from "drizzle-orm";

import { db, schema } from "@/db";

export async function markPlanDirty(planId: string): Promise<void> {
  await db
    .update(schema.plans)
    .set({ dirtySince: new Date() })
    .where(eq(schema.plans.id, planId));
}
