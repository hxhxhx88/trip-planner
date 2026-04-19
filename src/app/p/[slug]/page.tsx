import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ReleasedView } from "@/components/released/ReleasedView";
import { getAlertsForPlan } from "@/lib/model/alerts";
import { getPlanForReleased, getPlanIdBySlug } from "@/lib/model/released";
import Loading from "./loading";

export const unstable_instant = {
  prefetch: "static",
  samples: [{ params: { slug: "sample" } }],
};

export default function ReleasedPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return (
    <Suspense fallback={<Loading />}>
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
