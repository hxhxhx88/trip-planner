import { NewPlanTrigger } from "@/components/plans/NewPlanTrigger";
import { PlansList } from "@/components/plans/PlansList";
import { listPlans } from "@/lib/model/plans";

export default async function Home() {
  const plans = await listPlans();

  if (plans.length === 0) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 items-center px-6 py-24">
        <div className="w-full rounded-xl border border-dashed p-12 text-center">
          <h1 className="font-heading text-xl font-semibold">No plans yet</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Start by creating your first trip.
          </p>
          <div className="mt-6 flex justify-center">
            <NewPlanTrigger label="Create your first plan" />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="font-heading text-xl font-semibold">Your plans</h1>
        <NewPlanTrigger label="New plan" />
      </header>
      <PlansList rows={plans} />
    </main>
  );
}
