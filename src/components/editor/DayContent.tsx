"use client";

import { format, parseISO } from "date-fns";

import { TableView } from "@/components/editor/TableView";
import { TimelineView } from "@/components/editor/TimelineView";
import { ViewToggle, type EditorView } from "@/components/editor/ViewToggle";
import { useLocalStorage } from "@/lib/hooks";
import type { PlanForEditor } from "@/lib/model/plan";
import { useSelection } from "@/stores/selection";

type Props = {
  planId: string;
  day: PlanForEditor["days"][number];
  days: PlanForEditor["days"];
  events: PlanForEditor["events"];
  travels: PlanForEditor["travels"];
  places: PlanForEditor["places"];
};

export function DayContent({
  planId,
  day,
  days,
  events,
  travels,
  places,
}: Props) {
  const [view, setView] = useLocalStorage<EditorView>(
    `editor:view:${planId}`,
    "table",
  );

  const handleSelect = (id: string) => {
    useSelection.getState().select(id, "pane");
  };

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">
            {format(parseISO(day.date), "EEEE, MMM d")}
          </h2>
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
        />
      ) : (
        <TimelineView
          day={day}
          events={events}
          travels={travels}
          places={places}
          onSelect={handleSelect}
        />
      )}
    </div>
  );
}
