"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { setPlanTimezone } from "@/actions/plans";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Props = { planId: string; initialTimezone: string };

export function TimezoneForm({ planId, initialTimezone }: Props) {
  const router = useRouter();
  const [timezone, setTimezone] = useState(initialTimezone);
  const [isPending, startTransition] = useTransition();

  const timezones = useMemo(() => {
    const list =
      typeof Intl.supportedValuesOf === "function"
        ? Intl.supportedValuesOf("timeZone")
        : [];
    if (!list.includes(initialTimezone)) list.unshift(initialTimezone);
    return list;
  }, [initialTimezone]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!timezone || timezone === initialTimezone) return;
    startTransition(async () => {
      const res = await setPlanTimezone({ id: planId, timezone });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success("Time zone updated");
      router.refresh();
    });
  };

  const dirty = timezone !== initialTimezone;

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="settings-tz">Time zone</Label>
        <Select
          value={timezone}
          onValueChange={(v) => v !== null && setTimezone(v)}
        >
          <SelectTrigger id="settings-tz" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {timezones.map((tz) => (
              <SelectItem key={tz} value={tz}>
                {tz}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Changing the time zone rebases existing event times onto the new zone
          on the same calendar date.
        </p>
      </div>
      <Button type="submit" disabled={!dirty || isPending}>
        {isPending ? "Saving..." : "Save"}
      </Button>
    </form>
  );
}
