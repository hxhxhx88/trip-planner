import { format, parseISO } from "date-fns";

import { TableView } from "@/components/editor/TableView";
import type { PlanForEditor } from "@/lib/model/plan";

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
  return (
    <div className="space-y-4 p-6">
      <div>
        <h2 className="text-lg font-semibold">
          {format(parseISO(day.date), "EEEE, MMM d")}
        </h2>
        <p className="text-xs text-muted-foreground">{day.date}</p>
      </div>

      <TableView
        planId={planId}
        day={day}
        days={days}
        events={events}
        travels={travels}
        places={places}
      />
    </div>
  );
}
