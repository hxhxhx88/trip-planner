"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { VEHICLES, type Vehicle } from "@/lib/schemas";
import { VEHICLE_ICON, VEHICLE_LABEL } from "@/lib/vehicles";

type Props = {
  value: Vehicle | null;
  onChange: (next: Vehicle | null) => void;
  disabled?: boolean;
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
          const Icon = VEHICLE_ICON[v];
          return (
            <SelectItem key={v} value={v}>
              <Icon className="size-3.5" />
              {VEHICLE_LABEL[v]}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
