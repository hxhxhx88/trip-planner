import { BedIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { PlanForEditor } from "@/lib/model/plan";

type Props = {
  slot: "start" | "end";
  placeId: string | null;
  places: PlanForEditor["places"];
};

export function LodgingSlot({ slot, placeId, places }: Props) {
  const place = placeId ? places[placeId] : null;
  const label = slot === "start" ? "Start lodging" : "End lodging";
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <Button
        type="button"
        variant="outline"
        className="w-full justify-start gap-2 text-left font-normal"
        disabled
        title="Place picker arrives in 0005"
      >
        <BedIcon className="size-4" />
        {place ? place.name : "Pick lodging…"}
      </Button>
    </div>
  );
}
