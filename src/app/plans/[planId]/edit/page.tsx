import { notFound } from "next/navigation";
import { Suspense } from "react";

import { EditorShell } from "@/components/editor/EditorShell";
import { SelectionHydrator } from "@/components/editor/SelectionHydrator";
import { getPlanForEditor } from "@/lib/model/plan";

export default function EditPage({
  params,
}: {
  params: Promise<{ planId: string }>;
}) {
  return (
    <Suspense fallback={<EditorSkeleton />}>
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

function EditorSkeleton() {
  return (
    <div className="grid h-full grid-cols-2">
      <div className="border-r bg-muted/40" />
      <div className="p-6">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}
