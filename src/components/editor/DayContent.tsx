import { format, parseISO } from "date-fns";

import { EmptyDay } from "@/components/editor/EmptyDay";
import { LodgingSlot } from "@/components/editor/LodgingSlot";
import type { PlanForEditor } from "@/lib/model/plan";

type Props = {
  planId: string;
  day: PlanForEditor["days"][number];
  days: PlanForEditor["days"];
  places: PlanForEditor["places"];
};

export function DayContent({ planId, day, days, places }: Props) {
  const prevDayLodging = findPrevDayLodging(day, days);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h2 className="text-lg font-semibold">
          {format(parseISO(day.date), "EEEE, MMM d")}
        </h2>
        <p className="text-xs text-muted-foreground">{day.date}</p>
      </div>

      <LodgingSlot
        planId={planId}
        dayId={day.id}
        slot="start"
        placeId={day.startLodgingPlaceId}
        places={places}
        prevDayLodgingPlaceId={prevDayLodging}
      />

      <EmptyDay />

      <LodgingSlot
        planId={planId}
        dayId={day.id}
        slot="end"
        placeId={day.endLodgingPlaceId}
        places={places}
        prevDayLodgingPlaceId={prevDayLodging}
      />
    </div>
  );
}

function findPrevDayLodging(
  current: PlanForEditor["days"][number],
  days: PlanForEditor["days"],
): string | null {
  const earlier = days
    .filter((d) => d.date < current.date)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  for (const d of earlier) {
    if (d.startLodgingPlaceId) return d.startLodgingPlaceId;
    if (d.endLodgingPlaceId) return d.endLodgingPlaceId;
  }
  return null;
}
