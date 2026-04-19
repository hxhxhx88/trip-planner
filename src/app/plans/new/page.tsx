"use client";

import { useRouter } from "next/navigation";

import { NewPlanDialog } from "@/components/plans/NewPlanDialog";

export default function NewPlanPage() {
  const router = useRouter();
  return (
    <NewPlanDialog
      open
      onOpenChange={(next) => {
        if (!next) router.push("/");
      }}
    />
  );
}
