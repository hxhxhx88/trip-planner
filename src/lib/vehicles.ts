import { Bike, Bus, Car, Footprints, TrainFront, Waypoints } from "lucide-react";
import type { ComponentType } from "react";

import type { TransitSubtype, Vehicle } from "@/lib/schemas";

export const VEHICLE_LABEL: Record<string, string> = {
  walk: "Walk",
  drive: "Drive",
  cycle: "Cycle",
  transit: "Transit",
  "transit:subway": "Subway",
  "transit:bus": "Bus",
  "transit:connected": "Transit (connected)",
};

export const VEHICLE_ICON: Record<string, ComponentType<{ className?: string }>> = {
  walk: Footprints,
  drive: Car,
  cycle: Bike,
  transit: Bus,
  "transit:subway": TrainFront,
  "transit:bus": Bus,
  "transit:connected": Waypoints,
};

export function vehicleKey(
  vehicle: Vehicle | null,
  subtype: TransitSubtype | null = null,
): string | null {
  if (!vehicle) return null;
  if (vehicle === "transit" && subtype) return `transit:${subtype}`;
  return vehicle;
}
