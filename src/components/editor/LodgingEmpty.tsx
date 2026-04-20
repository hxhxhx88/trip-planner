"use client";

import { BedIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { inheritDayLodging, setDayLodging } from "@/actions/days";
import { PlacePicker } from "@/components/places/PlacePicker";
import { Button } from "@/components/ui/button";
import type { PlaceDetails } from "@/lib/google/types";

type Props = {
  planId: string;
  dayId: string;
  slot: "start" | "end";
  prevDayLodgingPlaceId: string | null;
};

export function LodgingEmpty({
  planId,
  dayId,
  slot,
  prevDayLodgingPlaceId,
}: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const commit = async (details: PlaceDetails) => {
    const res = await setDayLodging({
      planId,
      dayId,
      slot,
      placeId: details.googlePlaceId,
    });
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
  };

  const inherit = () => {
    startTransition(async () => {
      const res = await inheritDayLodging({ planId, dayId });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success("Inherited from previous day");
    });
  };

  return (
    <div className="space-y-1">
      <PlacePicker
        planId={planId}
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onCommit={commit}
        trigger={
          <Button
            type="button"
            variant="outline"
            className="w-full justify-start gap-2 text-left font-normal"
          >
            <BedIcon className="size-4" />
            Pick lodging…
          </Button>
        }
      />
      {slot === "start" && prevDayLodgingPlaceId ? (
        <button
          type="button"
          onClick={inherit}
          disabled={pending}
          className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline disabled:opacity-50"
        >
          Inherit from previous day
        </button>
      ) : null}
    </div>
  );
}
