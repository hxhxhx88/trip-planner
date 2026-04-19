import { LodgingSlot } from "@/components/editor/LodgingSlot";
import type { PlanForEditor } from "@/lib/model/plan";

type Props = {
  planId: string;
  dayId: string;
  slot: "start" | "end";
  placeId: string | null;
  places: PlanForEditor["places"];
  prevDayLodgingPlaceId: string | null;
};

export function LodgingRow({
  planId,
  dayId,
  slot,
  placeId,
  places,
  prevDayLodgingPlaceId,
}: Props) {
  return (
    <div
      role="row"
      className="border-l-2 border-amber-500/70 bg-amber-50/40 px-3 py-2 dark:border-amber-400/60 dark:bg-amber-950/20"
    >
      <LodgingSlot
        planId={planId}
        dayId={dayId}
        slot={slot}
        placeId={placeId}
        places={places}
        prevDayLodgingPlaceId={prevDayLodgingPlaceId}
      />
    </div>
  );
}
