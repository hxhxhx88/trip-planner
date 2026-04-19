"use client";

import { format, parseISO } from "date-fns";
import { ChevronDownIcon } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { PlanForEditor } from "@/lib/model/plan";
import { cn } from "@/lib/utils";
import { useSelection } from "@/stores/selection";

type Props = {
  days: PlanForEditor["days"];
};

export function DaySelector({ days }: Props) {
  const currentDayId = useSelection((s) => s.currentDayId);
  const setCurrentDay = useSelection((s) => s.setCurrentDay);
  const resolvedDayId =
    days.find((d) => d.id === currentDayId)?.id ?? days[0]?.id ?? null;
  const current = days.find((d) => d.id === resolvedDayId) ?? null;
  const currentIndex = current ? days.findIndex((d) => d.id === current.id) : -1;
  const label = current
    ? `Day ${currentIndex + 1} · ${format(parseISO(current.date), "MMM d")}`
    : "No day";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            disabled={days.length === 0}
            className="inline-flex items-center gap-1 rounded-md border border-transparent px-2 py-1 text-xs font-medium hover:bg-muted disabled:opacity-50"
            aria-label="Select day"
          >
            {label}
            <ChevronDownIcon className="size-3" />
          </button>
        }
      />
      <DropdownMenuContent align="end">
        {days.map((day, idx) => {
          const isActive = day.id === resolvedDayId;
          return (
            <DropdownMenuItem
              key={day.id}
              onClick={() => setCurrentDay(day.id)}
              className={cn(isActive && "bg-accent text-accent-foreground")}
            >
              <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mr-2">
                Day {idx + 1}
              </span>
              <span>{format(parseISO(day.date), "MMM d")}</span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
