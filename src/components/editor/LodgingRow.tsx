"use client";

import { LodgingSlot } from "@/components/editor/LodgingSlot";
import type { PlanForEditor } from "@/lib/model/plan";
import { cn } from "@/lib/utils";

type Props = {
  id: string;
  planId: string;
  dayId: string;
  slot: "start" | "end";
  placeId: string | null;
  places: PlanForEditor["places"];
  prevDayLodgingPlaceId: string | null;
  selected: boolean;
  hovered: boolean;
  onSelect: () => void;
  onHover: (hovering: boolean) => void;
  registerRef?: (id: string, el: HTMLElement | null) => void;
};

export function LodgingRow({
  id,
  planId,
  dayId,
  slot,
  placeId,
  places,
  prevDayLodgingPlaceId,
  selected,
  hovered,
  onSelect,
  onHover,
  registerRef,
}: Props) {
  return (
    <div
      ref={(el) => registerRef?.(id, el)}
      role="row"
      onClick={onSelect}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      className={cn(
        "border-l-2 px-3 py-2 transition-colors",
        selected
          ? "border-primary bg-primary/5"
          : "border-amber-500/70 bg-amber-50/40 dark:border-amber-400/60 dark:bg-amber-950/20",
        hovered && !selected && "bg-muted/30",
      )}
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
