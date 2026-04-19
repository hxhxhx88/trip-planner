"use client";

import { Bike, Bus, Car, Footprints } from "lucide-react";

import type { TimelineItem } from "@/components/editor/timeline/types";
import type { Vehicle } from "@/lib/schemas";
import { cn } from "@/lib/utils";

const VEHICLE_ICON: Record<
  Vehicle,
  React.ComponentType<{ className?: string }>
> = {
  walk: Footprints,
  drive: Car,
  transit: Bus,
  cycle: Bike,
};

type Props = {
  item: Extract<TimelineItem, { kind: "travel" }>;
  selected: boolean;
  onClick: () => void;
  onHover: (hovering: boolean) => void;
  registerRef?: (id: string, el: HTMLElement | null) => void;
};

export function TravelConnector({
  item,
  selected,
  onClick,
  onHover,
  registerRef,
}: Props) {
  const Icon = item.vehicle ? VEHICLE_ICON[item.vehicle] : null;
  const hasTime = item.travelTime != null;
  const label = hasTime ? `${item.travelTime} min` : "travel time TBD";

  return (
    <div
      className="absolute left-10 right-10"
      style={{ top: item.top, height: item.height }}
    >
      {item.status === "span" ? (
        <div
          className={cn(
            "absolute inset-y-0 left-1/2 -translate-x-1/2 border-l",
            hasTime
              ? "border-muted-foreground/50"
              : "border-dashed border-muted-foreground/50",
          )}
        />
      ) : null}
      <button
        ref={(el) => registerRef?.(item.id, el)}
        type="button"
        onClick={onClick}
        onMouseEnter={() => onHover(true)}
        onMouseLeave={() => onHover(false)}
        className={cn(
          "absolute left-1/2 top-1/2 z-10 inline-flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 whitespace-nowrap rounded-full border bg-background px-2 py-0.5 text-[10px] text-muted-foreground shadow-sm transition-colors hover:bg-muted",
          selected && "ring-2 ring-primary",
        )}
      >
        {Icon ? <Icon className="size-3" /> : null}
        {label}
      </button>
    </div>
  );
}
