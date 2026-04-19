import { Bike, Bus, Car, Footprints } from "lucide-react";
import type { ComponentType } from "react";

import type { Vehicle } from "@/lib/schemas";

export const VEHICLE_LABEL: Record<Vehicle, string> = {
  walk: "Walk",
  drive: "Drive",
  transit: "Transit",
  cycle: "Cycle",
};

export const VEHICLE_ICON: Record<Vehicle, ComponentType<{ className?: string }>> = {
  walk: Footprints,
  drive: Car,
  transit: Bus,
  cycle: Bike,
};
