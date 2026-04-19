"use client";

import { useMemo } from "react";
import { format, parseISO } from "date-fns";

import { TableView } from "@/components/editor/TableView";
import { TimelineView } from "@/components/editor/TimelineView";
import { ViewToggle, type EditorView } from "@/components/editor/ViewToggle";
import { useLocalStorage } from "@/lib/hooks";
import type { PlanForEditor } from "@/lib/model/plan";
import type { Alert } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import { useSelection } from "@/stores/selection";

type Props = {
  planId: string;
  day: PlanForEditor["days"][number];
  days: PlanForEditor["days"];
  events: PlanForEditor["events"];
  travels: PlanForEditor["travels"];
  places: PlanForEditor["places"];
  alertsByEntity: Record<string, Alert[]>;
};

export function DayContent({
  planId,
  day,
  days,
  events,
  travels,
  places,
  alertsByEntity,
}: Props) {
  const [view, setView] = useLocalStorage<EditorView>(
    `editor:view:${planId}`,
    "table",
  );

  const dayCounts = useMemo(() => {
    const keys = [
      `lodging-start:${day.id}`,
      `lodging-end:${day.id}`,
      ...events.filter((e) => e.dayId === day.id).map((e) => e.id),
      ...travels.filter((t) => t.dayId === day.id).map((t) => t.id),
    ];
    let issues = 0;
    let warnings = 0;
    for (const k of keys) {
      const arr = alertsByEntity[k];
      if (!arr) continue;
      for (const a of arr) {
        if (a.severity === "issue") issues += 1;
        else warnings += 1;
      }
    }
    return { issues, warnings };
  }, [alertsByEntity, day.id, events, travels]);

  const handleSelect = (id: string) => {
    useSelection.getState().select(id, "pane");
  };

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">
              {format(parseISO(day.date), "EEEE, MMM d")}
            </h2>
            {dayCounts.issues + dayCounts.warnings > 0 ? (
              <DayCountBadge
                issues={dayCounts.issues}
                warnings={dayCounts.warnings}
              />
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">{day.date}</p>
        </div>
        <ViewToggle value={view} onChange={setView} />
      </div>

      {view === "table" ? (
        <TableView
          planId={planId}
          day={day}
          days={days}
          events={events}
          travels={travels}
          places={places}
          alertsByEntity={alertsByEntity}
        />
      ) : (
        <TimelineView
          day={day}
          events={events}
          travels={travels}
          places={places}
          alertsByEntity={alertsByEntity}
          onSelect={handleSelect}
        />
      )}
    </div>
  );
}

function DayCountBadge({
  issues,
  warnings,
}: {
  issues: number;
  warnings: number;
}) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium tabular-nums"
      aria-label={`${issues} issues, ${warnings} warnings`}
    >
      {issues > 0 ? (
        <span
          className={cn(
            "inline-flex items-center gap-0.5",
            "text-red-600 dark:text-red-400",
          )}
        >
          <span className="size-1.5 rounded-full bg-red-500" />
          {issues}
        </span>
      ) : null}
      {warnings > 0 ? (
        <span
          className={cn(
            "inline-flex items-center gap-0.5",
            "text-amber-600 dark:text-amber-400",
          )}
        >
          <span className="size-1.5 rounded-full bg-amber-500" />
          {warnings}
        </span>
      ) : null}
    </span>
  );
}
