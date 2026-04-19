"use client";

import { BedIcon, Clock, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { setDayLodging } from "@/actions/days";
import { HoursEditor } from "@/components/places/HoursEditor";
import { PlacePicker } from "@/components/places/PlacePicker";
import { PlacePreview } from "@/components/places/PlacePreview";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { PlaceDetails } from "@/lib/google/types";
import type { PlanForEditor } from "@/lib/model/plan";

type Props = {
  planId: string;
  dayId: string;
  slot: "start" | "end";
  place: PlanForEditor["places"][string];
};

export function LodgingFilled({ planId, dayId, slot, place }: Props) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [hoursOpen, setHoursOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const change = async (details: PlaceDetails) => {
    const res = await setDayLodging({
      planId,
      dayId,
      slot,
      placeId: details.googlePlaceId,
    });
    if (!res.ok) toast.error(res.error.message);
  };

  const remove = async () => {
    setPreviewOpen(false);
    const res = await setDayLodging({ planId, dayId, slot, placeId: null });
    if (!res.ok) toast.error(res.error.message);
  };

  return (
    <div className="space-y-1">
      <Popover open={previewOpen} onOpenChange={setPreviewOpen}>
        <PopoverTrigger
          render={
            <button
              type="button"
              className="flex w-full items-start gap-2 rounded-md border bg-background px-3 py-2 text-left transition-colors hover:bg-muted/40"
            >
              <BedIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {place.name}
                </span>
                {place.address ? (
                  <span className="block truncate text-xs text-muted-foreground">
                    {place.address}
                  </span>
                ) : null}
              </span>
            </button>
          }
        />
        <PopoverContent className="w-96" align="start">
          <div className="flex flex-col gap-3">
            <PlacePreview place={place} />
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setPreviewOpen(false);
                  setHoursOpen(true);
                }}
              >
                <Clock className="size-3.5" />
                Edit hours
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setPreviewOpen(false);
                  setPickerOpen(true);
                }}
              >
                <Pencil className="size-3.5" />
                Change
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={remove}
              >
                <Trash2 className="size-3.5" />
                Remove
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      <HoursEditor
        open={hoursOpen}
        onOpenChange={setHoursOpen}
        planId={planId}
        placeId={place.googlePlaceId}
        placeName={place.name}
        initial={{ hours: place.hours, source: place.hoursSource }}
      />

      <PlacePicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onCommit={change}
      />
    </div>
  );
}
