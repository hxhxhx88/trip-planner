"use client";

import { Bike, Bus, Car, Footprints } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { VEHICLES, type Vehicle } from "@/lib/schemas";

type Props = {
  value: Vehicle | null;
  onChange: (next: Vehicle | null) => void;
  disabled?: boolean;
};

const LABEL: Record<Vehicle, string> = {
  walk: "Walk",
  drive: "Drive",
  transit: "Transit",
  cycle: "Cycle",
};

const ICON: Record<Vehicle, React.ComponentType<{ className?: string }>> = {
  walk: Footprints,
  drive: Car,
  transit: Bus,
  cycle: Bike,
};

export function VehicleSelect({ value, onChange, disabled }: Props) {
  return (
    <Select
      value={value ?? ""}
      onValueChange={(v) => onChange((v || null) as Vehicle | null)}
      disabled={disabled}
    >
      <SelectTrigger size="sm" className="w-full">
        <SelectValue placeholder="Pick vehicle" />
      </SelectTrigger>
      <SelectContent>
        {VEHICLES.map((v) => {
          const Icon = ICON[v];
          return (
            <SelectItem key={v} value={v}>
              <Icon className="size-3.5" />
              {LABEL[v]}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
