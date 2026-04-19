"use client";

import { useState, useTransition } from "react";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { toast } from "sonner";

import { addDay } from "@/actions/days";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSelection } from "@/stores/selection";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planId: string;
  timezone: string;
  existingDates: string[];
};

export function AddDayDialog({
  open,
  onOpenChange,
  planId,
  timezone,
  existingDates,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {open ? (
          <AddDayForm
            planId={planId}
            timezone={timezone}
            existingDates={existingDates}
            onClose={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

type FormProps = {
  planId: string;
  timezone: string;
  existingDates: string[];
  onClose: () => void;
};

function AddDayForm({ planId, timezone, existingDates, onClose }: FormProps) {
  const [date, setDate] = useState(() =>
    formatInTimeZone(new Date(), timezone, "yyyy-MM-dd"),
  );
  const [error, setError] = useState<string | null>(null);
  const [warningConfirmed, setWarningConfirmed] = useState(false);
  const [isPending, startTransition] = useTransition();

  const isDuplicate = !!date && existingDates.includes(date);

  const gapWarning = (() => {
    if (!date || isDuplicate || existingDates.length === 0) return null;
    const target = parseISO(date);
    let closestDiff = Infinity;
    let closestDate = existingDates[0];
    for (const d of existingDates) {
      const diff = Math.abs(differenceInCalendarDays(target, parseISO(d)));
      if (diff < closestDiff) {
        closestDiff = diff;
        closestDate = d;
      }
    }
    if (closestDiff < 2) return null;
    return { days: closestDiff, nearest: closestDate };
  })();

  const handleDateChange = (next: string) => {
    setDate(next);
    setError(null);
    setWarningConfirmed(false);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!date) return;
    if (isDuplicate) {
      setError("A day with this date already exists");
      return;
    }
    if (gapWarning && !warningConfirmed) {
      setWarningConfirmed(true);
      return;
    }
    startTransition(async () => {
      const res = await addDay({ planId, date });
      if (!res.ok) {
        if (res.error.code === "conflict") {
          setError(res.error.message);
        } else {
          toast.error(res.error.message);
        }
        return;
      }
      toast.success("Day added");
      useSelection.getState().setCurrentDay(res.data.id);
      onClose();
    });
  };

  const submitLabel = isPending
    ? "Adding…"
    : gapWarning && warningConfirmed
      ? "Add anyway"
      : "Add day";

  return (
    <form onSubmit={submit} className="space-y-4">
      <DialogHeader>
        <DialogTitle>Add a day</DialogTitle>
        <DialogDescription>Pick the date for the new day.</DialogDescription>
      </DialogHeader>

      <div className="space-y-2">
        <Label htmlFor="day-date">Date</Label>
        <Input
          id="day-date"
          type="date"
          value={date}
          onChange={(e) => handleDateChange(e.target.value)}
          required
          autoFocus
        />
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : gapWarning ? (
          <p className="text-sm text-amber-600 dark:text-amber-500">
            {gapWarning.days} days from the nearest existing day (
            {gapWarning.nearest}). Continue?
          </p>
        ) : null}
      </div>

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={isPending}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isPending || !date || isDuplicate}>
          {submitLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}
