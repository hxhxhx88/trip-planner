"use client";

import { format, parseISO } from "date-fns";
import { MapIcon } from "lucide-react";

import type { PlanForEditor } from "@/lib/model/plan";
import { useSelection } from "@/stores/selection";

type Props = {
  days: PlanForEditor["days"];
};

export function MapPanePlaceholder({ days }: Props) {
  const currentDayId = useSelection((s) => s.currentDayId);
  const currentDay =
    days.find((d) => d.id === currentDayId) ?? days[0] ?? null;
  const label = currentDay
    ? format(parseISO(currentDay.date), "EEE, MMM d")
    : "No day selected";

  return (
    <div className="flex h-full flex-col bg-muted/40">
      <div className="flex items-center justify-between border-b bg-background/60 px-4 py-2 backdrop-blur">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">Map · 0007</span>
      </div>
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        <div className="flex flex-col items-center gap-2 text-sm">
          <MapIcon className="size-6 opacity-40" />
          <span>Map renders here</span>
        </div>
      </div>
    </div>
  );
}
