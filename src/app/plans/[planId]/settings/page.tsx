import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeftIcon } from "lucide-react";

import { DangerZone } from "@/components/plans/settings/DangerZone";
import { RenamePlanForm } from "@/components/plans/settings/RenamePlanForm";
import { TimezoneForm } from "@/components/plans/settings/TimezoneForm";
import { Separator } from "@/components/ui/separator";
import { getPlan } from "@/lib/model/plans";

export default function PlanSettingsPage({
  params,
}: {
  params: Promise<{ planId: string }>;
}) {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
      <div className="mb-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeftIcon className="size-3.5" />
          All plans
        </Link>
      </div>
      <Suspense fallback={<SettingsSkeleton />}>
        <SettingsContent paramsPromise={params} />
      </Suspense>
    </main>
  );
}

async function SettingsContent({
  paramsPromise,
}: {
  paramsPromise: Promise<{ planId: string }>;
}) {
  const { planId } = await paramsPromise;
  const plan = await getPlan(planId);
  if (!plan) notFound();

  return (
    <>
      <header className="mb-6">
        <h1 className="font-heading text-xl font-semibold">{plan.name}</h1>
        <p className="text-sm text-muted-foreground">Plan settings</p>
      </header>

      <section className="space-y-4">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          General
        </h2>
        <RenamePlanForm planId={plan.id} initialName={plan.name} />
        <TimezoneForm planId={plan.id} initialTimezone={plan.timezone} />
      </section>

      <Separator className="my-10" />

      <section className="space-y-4">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Danger zone
        </h2>
        <DangerZone planId={plan.id} planName={plan.name} />
      </section>
    </>
  );
}

function SettingsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-7 w-40 animate-pulse rounded bg-muted" />
      <div className="h-9 w-full animate-pulse rounded bg-muted" />
      <div className="h-9 w-full animate-pulse rounded bg-muted" />
    </div>
  );
}
