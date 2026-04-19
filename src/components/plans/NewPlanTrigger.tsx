"use client";

import { useState } from "react";
import { PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { NewPlanDialog } from "@/components/plans/NewPlanDialog";

type Props = {
  label?: string;
  size?: "sm" | "default" | "lg";
};

export function NewPlanTrigger({ label = "New plan", size = "default" }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size={size} onClick={() => setOpen(true)}>
        <PlusIcon data-icon="inline-start" />
        {label}
      </Button>
      <NewPlanDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
