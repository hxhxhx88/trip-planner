import type { Metadata } from "next";
import type { ReactNode } from "react";

import { getPlanForReleased, getPlanIdBySlug } from "@/lib/model/released";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const notFoundMeta: Metadata = {
    title: "Trip not found",
    robots: { index: false, follow: false },
  };

  const planId = await getPlanIdBySlug(slug);
  if (!planId) return notFoundMeta;
  const data = await getPlanForReleased(planId);
  if (!data) return notFoundMeta;

  const firstDay = data.days[0];
  const coverPlaceId =
    data.events.find((e) => e.dayId === firstDay?.id && e.placeId)?.placeId ??
    firstDay?.startLodgingPlaceId ??
    null;
  const hasCover =
    coverPlaceId != null && (data.places[coverPlaceId]?.photos.length ?? 0) > 0;

  return {
    title: data.plan.name,
    robots: { index: false, follow: false },
    openGraph: {
      title: data.plan.name,
      type: "article",
      ...(hasCover
        ? {
            images: [
              {
                url: `/places/${coverPlaceId}/0.jpg`,
                width: 1200,
                height: 630,
                alt: data.plan.name,
              },
            ],
          }
        : {}),
    },
  };
}

export default function ReleasedLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-md px-4 pb-20 pt-6">{children}</div>
    </div>
  );
}
