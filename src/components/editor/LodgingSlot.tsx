import { LodgingEmpty } from "@/components/editor/LodgingEmpty";
import { LodgingFilled } from "@/components/editor/LodgingFilled";
import type { PlanForEditor } from "@/lib/model/plan";

type Props = {
  planId: string;
  dayId: string;
  slot: "start" | "end";
  placeId: string | null;
  places: PlanForEditor["places"];
  prevDayLodgingPlaceId: string | null;
};

export function LodgingSlot({
  planId,
  dayId,
  slot,
  placeId,
  places,
  prevDayLodgingPlaceId,
}: Props) {
  const place = placeId ? places[placeId] : null;
  const label = slot === "start" ? "Start lodging" : "End lodging";

  return (
    <div className="space-y-1">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      {place ? (
        <LodgingFilled
          planId={planId}
          dayId={dayId}
          slot={slot}
          place={place}
        />
      ) : (
        <LodgingEmpty
          planId={planId}
          dayId={dayId}
          slot={slot}
          prevDayLodgingPlaceId={prevDayLodgingPlaceId}
        />
      )}
    </div>
  );
}
