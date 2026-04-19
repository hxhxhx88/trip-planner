import { notFound } from "next/navigation";
import { Suspense } from "react";

import { EditorShell } from "@/components/editor/EditorShell";
import { SelectionHydrator } from "@/components/editor/SelectionHydrator";
import { getPlanForEditor } from "@/lib/model/plan";
import Loading from "./loading";

export const unstable_instant = {
  prefetch: "static",
  samples: [{ params: { planId: "sample" } }],
};

export default function EditPage({
  params,
}: {
  params: Promise<{ planId: string }>;
}) {
  return (
    <Suspense fallback={<Loading />}>
      <EditorContent paramsPromise={params} />
    </Suspense>
  );
}

async function EditorContent({
  paramsPromise,
}: {
  paramsPromise: Promise<{ planId: string }>;
}) {
  const { planId } = await paramsPromise;
  const data = await getPlanForEditor(planId);
  if (!data) notFound();
  const initialDayId = data.days[0]?.id ?? null;
  return (
    <>
      <SelectionHydrator planId={planId} initialDayId={initialDayId} />
      <div className="h-full">
        <EditorShell data={data} />
      </div>
    </>
  );
}
