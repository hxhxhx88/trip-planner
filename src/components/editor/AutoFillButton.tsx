"use client";

import { useTransition } from "react";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";

import { runAutoFill } from "@/actions/autofill";
import { Button } from "@/components/ui/button";

type Props = {
  planId: string;
  isDirty: boolean;
};

export function AutoFillButton({ planId, isDirty }: Props) {
  const [isPending, startTransition] = useTransition();

  const onClick = () => {
    if (isPending) return;
    startTransition(async () => {
      const res = await runAutoFill({ planId });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      const issues = res.data.alerts.filter((a) => a.severity === "issue").length;
      const warnings = res.data.alerts.filter(
        (a) => a.severity === "warning",
      ).length;
      toast.success(
        `Auto Fill complete · ${issues} issue${issues === 1 ? "" : "s"}, ${warnings} warning${warnings === 1 ? "" : "s"}`,
      );
    });
  };

  const label = isPending ? "Filling…" : isDirty ? "Auto Fill" : "Auto Fill again";
  const variant = isDirty ? "default" : "outline";

  return (
    <Button
      type="button"
      variant={variant}
      size="sm"
      onClick={onClick}
      disabled={isPending}
      className="gap-1"
    >
      {isPending && <Loader2Icon className="size-3.5 animate-spin" />}
      {label}
    </Button>
  );
}
