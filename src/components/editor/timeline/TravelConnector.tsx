"use client";

import { InlineMarker } from "@/components/alerts/InlineMarker";
import type { TimelineItem } from "@/components/editor/timeline/types";
import type { Alert } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import { VEHICLE_ICON, vehicleKey } from "@/lib/vehicles";

type Props = {
  item: Extract<TimelineItem, { kind: "travel" }>;
  selected: boolean;
  onClick: () => void;
  onHover: (hovering: boolean) => void;
  registerRef?: (id: string, el: HTMLElement | null) => void;
  alerts: Alert[];
};

export function TravelConnector({
  item,
  selected,
  onClick,
  onHover,
  registerRef,
  alerts,
}: Props) {
  const key = vehicleKey(item.vehicle, item.transitSubtype);
  const Icon = key ? VEHICLE_ICON[key] : null;
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
        {alerts.length > 0 ? (
          <InlineMarker alerts={alerts} className="ml-0.5" />
        ) : null}
      </button>
    </div>
  );
}
