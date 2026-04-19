import { cacheTag } from "next/cache";

import { getPlanForEditor } from "@/lib/model/plan";
import type { Alert } from "@/lib/schemas";
import { validate } from "@/lib/validate";

export async function getAlertsForPlan(planId: string): Promise<Alert[]> {
  "use cache";
  cacheTag(`plan:${planId}`);
  const plan = await getPlanForEditor(planId);
  if (!plan) return [];
  return validate(plan);
}
