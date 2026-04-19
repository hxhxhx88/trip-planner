import { format, parseISO } from "date-fns";

import { EmptyDay } from "@/components/editor/EmptyDay";
import { LodgingSlot } from "@/components/editor/LodgingSlot";
import type { PlanForEditor } from "@/lib/model/plan";

type Props = {
  day: PlanForEditor["days"][number];
  places: PlanForEditor["places"];
};

export function DayContent({ day, places }: Props) {
  return (
    <div className="space-y-6 p-6">
      <div>
        <h2 className="text-lg font-semibold">
          {format(parseISO(day.date), "EEEE, MMM d")}
        </h2>
        <p className="text-xs text-muted-foreground">{day.date}</p>
      </div>

      <LodgingSlot
        slot="start"
        placeId={day.startLodgingPlaceId}
        places={places}
      />

      <EmptyDay />

      <LodgingSlot
        slot="end"
        placeId={day.endLodgingPlaceId}
        places={places}
      />
    </div>
  );
}
