"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { clearHoursOverride, setHoursOverride } from "@/actions/places";
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
import type { PlaceHours, WeeklyHours } from "@/lib/schemas";

type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

const WEEKDAY_ORDER: { value: Weekday; label: string }[] = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
];

type Row = {
  closed: boolean;
  open: string;
  close: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planId: string;
  placeId: string;
  placeName: string;
  initial: { hours: PlaceHours | null; source: "google" | "override" };
};

export function HoursEditor({
  open,
  onOpenChange,
  planId,
  placeId,
  placeName,
  initial,
}: Props) {
  const [rows, setRows] = useState<Record<Weekday, Row>>(() =>
    fromHours(initial.hours),
  );
  const [pending, startTransition] = useTransition();

  function update(day: Weekday, patch: Partial<Row>) {
    setRows((prev) => ({ ...prev, [day]: { ...prev[day], ...patch } }));
  }

  const save = () => {
    const weekly: WeeklyHours[] = [];
    for (const { value } of WEEKDAY_ORDER) {
      const row = rows[value];
      if (row.closed) continue;
      if (!isValidTime(row.open) || !isValidTime(row.close)) {
        toast.error("Invalid time format. Use HH:MM.");
        return;
      }
      weekly.push({ weekday: value, open: row.open, close: row.close });
    }
    startTransition(async () => {
      const res = await setHoursOverride({
        planId,
        placeId,
        hours: { weekly },
      });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success("Hours saved");
      onOpenChange(false);
    });
  };

  const reset = () => {
    startTransition(async () => {
      const res = await clearHoursOverride({ planId, placeId });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success("Override cleared");
      onOpenChange(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Hours — {placeName}</DialogTitle>
          <DialogDescription>
            Per-Plan override · source: {initial.source}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          {WEEKDAY_ORDER.map(({ value, label }) => {
            const row = rows[value];
            return (
              <div
                key={value}
                className="grid grid-cols-[3rem_1fr_auto_1fr_auto] items-center gap-2"
              >
                <Label className="text-sm font-medium">{label}</Label>
                <Input
                  type="time"
                  value={row.open}
                  onChange={(e) => update(value, { open: e.target.value })}
                  disabled={row.closed}
                />
                <span className="text-muted-foreground">–</span>
                <Input
                  type="time"
                  value={row.close}
                  onChange={(e) => update(value, { close: e.target.value })}
                  disabled={row.closed}
                />
                <label className="flex items-center gap-1 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={row.closed}
                    onChange={(e) =>
                      update(value, { closed: e.target.checked })
                    }
                  />
                  Closed
                </label>
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={reset}
            disabled={pending || initial.source === "google"}
          >
            Reset to Google
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button type="button" onClick={save} disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function fromHours(hours: PlaceHours | null): Record<Weekday, Row> {
  const out = {} as Record<Weekday, Row>;
  for (const { value } of WEEKDAY_ORDER) {
    const found = hours?.weekly.find((w) => w.weekday === value);
    out[value] = found
      ? { closed: false, open: found.open, close: found.close }
      : { closed: true, open: "09:00", close: "17:00" };
  }
  return out;
}

function isValidTime(s: string): boolean {
  return /^\d{2}:\d{2}$/.test(s);
}
