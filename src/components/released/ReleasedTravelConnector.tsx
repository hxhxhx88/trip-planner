import { HelpCircle } from "lucide-react";

import type { DayTravel } from "@/lib/model/day";
import { VEHICLES, type Alert, type Vehicle } from "@/lib/schemas";
import { VEHICLE_ICON, VEHICLE_LABEL } from "@/lib/vehicles";
import { cn } from "@/lib/utils";

type Props = {
  travel: DayTravel;
  alerts: Alert[];
};

export function ReleasedTravelConnector({ travel, alerts }: Props) {
  const vehicle = isVehicle(travel.vehicle) ? travel.vehicle : null;
  const Icon = vehicle ? VEHICLE_ICON[vehicle] : HelpCircle;
  const label = vehicle ? VEHICLE_LABEL[vehicle] : "No vehicle";
  const travelTime = travel.travelTime;

  const hasIssue = alerts.some((a) => a.severity === "issue");
  const hasWarning = alerts.some((a) => a.severity === "warning");

  return (
    <div className="flex items-center justify-center">
      <div className="relative flex items-center gap-2 py-2">
        <div
          aria-hidden="true"
          className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-border"
        />
        <span className="relative z-10 inline-flex items-center gap-1.5 rounded-full border bg-background px-3 py-1 text-xs">
          <Icon className="size-3.5" />
          <span className="font-medium">{label}</span>
          {travelTime != null ? (
            <span className="text-muted-foreground">· {formatTravel(travelTime)}</span>
          ) : null}
          {hasIssue || hasWarning ? (
            <span
              aria-label={hasIssue ? "issue alert" : "warning alert"}
              className={cn(
                "size-1.5 rounded-full",
                hasIssue ? "bg-red-500" : "bg-amber-500",
              )}
            />
          ) : null}
        </span>
      </div>
    </div>
  );
}

function isVehicle(v: string | null): v is Vehicle {
  return v !== null && (VEHICLES as readonly string[]).includes(v);
}

function formatTravel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const r = minutes % 60;
  return r === 0 ? `${h} hr` : `${h} hr ${r} min`;
}
