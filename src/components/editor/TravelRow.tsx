"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { updateTravel } from "@/actions/travels";
import { VehicleSelect } from "@/components/editor/VehicleSelect";
import type { DayTravel } from "@/lib/model/day";
import type { Vehicle } from "@/lib/schemas";

type Props = {
  planId: string;
  travel: DayTravel;
};

export function TravelRow({ planId, travel }: Props) {
  const router = useRouter();
  const [vehicle, setVehicle] = useState<Vehicle | null>(
    (travel.vehicle as Vehicle | null) ?? null,
  );
  const [pending, startTransition] = useTransition();
  const isOptimistic = travel.id.startsWith("opt-");

  const onChange = (next: Vehicle | null) => {
    if (isOptimistic) return;
    setVehicle(next);
    startTransition(async () => {
      const res = await updateTravel({
        planId,
        id: travel.id,
        expectedUpdatedAt: travel.updatedAt,
        patch: { vehicle: next },
      });
      if (!res.ok) {
        toast.error(res.error.message);
        setVehicle((travel.vehicle as Vehicle | null) ?? null);
        return;
      }
      if (res.data.merged) {
        toast("Merged changes from another tab");
        router.refresh();
      }
    });
  };

  return (
    <div
      role="row"
      className="grid items-center gap-2 border-l-2 border-muted px-3 py-1.5 text-xs text-muted-foreground"
      style={{ gridTemplateColumns: "140px 1fr 24px 72px" }}
    >
      <div role="cell">
        <VehicleSelect
          value={vehicle}
          onChange={onChange}
          disabled={isOptimistic || pending}
        />
      </div>
      <div role="cell" className="truncate">
        {vehicle
          ? travel.travelTime != null
            ? `${travel.travelTime} min`
            : "Auto Fill to compute"
          : "Pick a vehicle to estimate travel time"}
      </div>
      <div role="cell" />
      <div role="cell" />
    </div>
  );
}
