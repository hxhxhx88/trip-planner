"use client";

import { Bike, Bus, Car, Footprints } from "lucide-react";

import { InlineMarker } from "@/components/alerts/InlineMarker";
import type { TimelineUnscheduled } from "@/components/editor/timeline/types";
import type { Alert, Vehicle } from "@/lib/schemas";
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

const EVENT_REASON_LABEL: Record<"no-start" | "no-duration", string> = {
  "no-start": "no start time",
  "no-duration": "no stay duration",
};

type Props = {
  items: TimelineUnscheduled[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
  registerRef?: (id: string, el: HTMLElement | null) => void;
  alertsByEntity: Record<string, Alert[]>;
};

export function UnscheduledPill({
  items,
  selectedId,
  onSelect,
  onHover,
  registerRef,
  alertsByEntity,
}: Props) {
  if (items.length === 0) return null;

  return (
    <div className="mt-4 space-y-2 border-t pt-3">
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Unscheduled
      </div>
      <ul className="flex flex-wrap gap-1.5">
        {items.map((item) => {
          const selected = selectedId === item.id;
          const itemAlerts = alertsByEntity[item.id] ?? [];
          if (item.kind === "event") {
            return (
              <li key={item.id}>
                <button
                  ref={(el) => registerRef?.(item.id, el)}
                  type="button"
                  onClick={() => onSelect(item.id)}
                  onMouseEnter={() => onHover(item.id)}
                  onMouseLeave={() => onHover(null)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border bg-background px-2 py-1 text-xs hover:bg-muted",
                    selected && "ring-2 ring-primary",
                  )}
                >
                  <span className="font-medium">
                    {item.placeName ?? "No place"}
                  </span>
                  <span className="text-muted-foreground">
                    · {EVENT_REASON_LABEL[item.reason]}
                  </span>
                  {itemAlerts.length > 0 ? (
                    <InlineMarker alerts={itemAlerts} />
                  ) : null}
                </button>
              </li>
            );
          }
          const Icon = item.vehicle ? VEHICLE_ICON[item.vehicle] : null;
          return (
            <li key={item.id}>
              <button
                ref={(el) => registerRef?.(item.id, el)}
                type="button"
                onClick={() => onSelect(item.id)}
                onMouseEnter={() => onHover(item.id)}
                onMouseLeave={() => onHover(null)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border bg-background px-2 py-1 text-xs text-muted-foreground hover:bg-muted",
                  selected && "ring-2 ring-primary",
                )}
              >
                {Icon ? <Icon className="size-3" /> : null}
                <span>travel · no anchor</span>
                {itemAlerts.length > 0 ? (
                  <InlineMarker alerts={itemAlerts} />
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
