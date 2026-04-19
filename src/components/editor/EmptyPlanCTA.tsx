"use client";

import { useState } from "react";
import { CalendarPlusIcon } from "lucide-react";

import { AddDayDialog } from "@/components/editor/AddDayDialog";
import { Button } from "@/components/ui/button";

type Props = {
  planId: string;
  timezone: string;
};

export function EmptyPlanCTA({ planId, timezone }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="flex max-w-sm flex-col items-center gap-4 text-center">
        <div className="rounded-full bg-muted p-4">
          <CalendarPlusIcon className="size-6 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Plan an itinerary</h2>
          <p className="text-sm text-muted-foreground">
            Start by adding the first day of your trip.
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>Add your first day</Button>
      </div>
      <AddDayDialog
        open={open}
        onOpenChange={setOpen}
        planId={planId}
        timezone={timezone}
        existingDates={[]}
      />
    </div>
  );
}
