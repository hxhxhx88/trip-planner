import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ReleasedView } from "@/components/released/ReleasedView";
import { getAlertsForPlan } from "@/lib/model/alerts";
import { getPlanForReleased, getPlanIdBySlug } from "@/lib/model/released";

export default function ReleasedPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return (
    <Suspense fallback={<ReleasedSkeleton />}>
      <ReleasedContent paramsPromise={params} />
    </Suspense>
  );
}

async function ReleasedContent({
  paramsPromise,
}: {
  paramsPromise: Promise<{ slug: string }>;
}) {
  const { slug } = await paramsPromise;
  const planId = await getPlanIdBySlug(slug);
  if (!planId) notFound();
  const [data, alerts] = await Promise.all([
    getPlanForReleased(planId),
    getAlertsForPlan(planId),
  ]);
  if (!data) notFound();
  return <ReleasedView data={data} alerts={alerts} />;
}

function ReleasedSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-7 w-48 animate-pulse rounded bg-muted" />
        <div className="h-4 w-32 animate-pulse rounded bg-muted" />
      </div>
      <div className="space-y-3">
        <div className="h-20 animate-pulse rounded-xl bg-muted" />
        <div className="h-56 animate-pulse rounded-xl bg-muted" />
        <div className="h-56 animate-pulse rounded-xl bg-muted" />
      </div>
    </div>
  );
}
