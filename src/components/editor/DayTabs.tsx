"use client";

import { useState, useTransition } from "react";
import { format, parseISO } from "date-fns";
import { MoreHorizontalIcon, PlusIcon } from "lucide-react";
import { toast } from "sonner";

import { deleteDay } from "@/actions/days";
import { AddDayDialog } from "@/components/editor/AddDayDialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { PlanForEditor } from "@/lib/model/plan";
import { useSelection } from "@/stores/selection";

type Props = {
  planId: string;
  timezone: string;
  days: PlanForEditor["days"];
};

export function DayTabs({ planId, timezone, days }: Props) {
  const currentDayId = useSelection((s) => s.currentDayId);
  const setCurrentDay = useSelection((s) => s.setCurrentDay);
  const resolvedDayId = days.find((d) => d.id === currentDayId)?.id
    ?? days[0]?.id
    ?? null;
  const [addOpen, setAddOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const onDelete = (dayId: string) => {
    if (pendingDeleteId) return;
    if (!confirm("Delete this day? Events on this day will be removed.")) {
      return;
    }
    setPendingDeleteId(dayId);
    startTransition(async () => {
      const res = await deleteDay({ planId, dayId });
      setPendingDeleteId(null);
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success("Day deleted");
      if (resolvedDayId === dayId) {
        const remaining = days.filter((d) => d.id !== dayId);
        setCurrentDay(remaining[0]?.id ?? null);
      }
    });
  };

  return (
    <div className="flex items-center gap-1 overflow-x-auto border-b px-3 py-2">
      {days.map((day, idx) => {
        const isActive = day.id === resolvedDayId;
        const isPending = pendingDeleteId === day.id;
        return (
          <div
            key={day.id}
            className={cn(
              "group flex shrink-0 items-stretch overflow-hidden rounded-md border",
              isActive
                ? "border-foreground/40 bg-accent text-accent-foreground"
                : "border-transparent hover:bg-muted",
              isPending && "opacity-60",
            )}
          >
            <button
              type="button"
              onClick={() => setCurrentDay(day.id)}
              className="flex flex-col items-start px-3 py-1 text-left"
            >
              <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Day {idx + 1}
              </span>
              <span className="text-sm font-medium leading-tight">
                {format(parseISO(day.date), "MMM d")}
              </span>
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button
                    type="button"
                    className="flex items-center px-1 text-muted-foreground hover:text-foreground"
                    aria-label="Day actions"
                  >
                    <MoreHorizontalIcon className="size-3.5" />
                  </button>
                }
              />
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => onDelete(day.id)}
                  disabled={isPending}
                >
                  Delete day
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      })}

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="shrink-0 gap-1"
        onClick={() => setAddOpen(true)}
      >
        <PlusIcon className="size-3.5" />
        Add day
      </Button>

      <AddDayDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        planId={planId}
        timezone={timezone}
        existingDates={days.map((d) => d.date)}
      />
    </div>
  );
}
