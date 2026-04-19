"use client";

import { useMemo, useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { createPlan } from "@/actions/plans";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const subscribe = () => () => {};
const getBrowserTz = () =>
  Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC";
const getServerTz = () => "";

export function NewPlanDialog({ open, onOpenChange }: Props) {
  const router = useRouter();
  const browserTz = useSyncExternalStore(subscribe, getBrowserTz, getServerTz);
  const [name, setName] = useState("");
  const [userTz, setUserTz] = useState<string | null>(null);
  const timezone = userTz ?? browserTz;
  const [isPending, startTransition] = useTransition();

  const timezones = useMemo(() => {
    if (typeof Intl.supportedValuesOf === "function") {
      return Intl.supportedValuesOf("timeZone");
    }
    return [];
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || !timezone) return;
    startTransition(async () => {
      const res = await createPlan({
        name: trimmed,
        timezone,
        tzSetByUser: userTz !== null,
      });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success("Plan created");
      setName("");
      setUserTz(null);
      onOpenChange(false);
      router.replace(`/plans/${res.data.id}/edit`);
    });
  };

  return (
    <Dialog open={open} onOpenChange={(next) => onOpenChange(next)}>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>New plan</DialogTitle>
            <DialogDescription>
              Name your trip and pick the time zone it lives in.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="plan-name">Name</Label>
            <Input
              id="plan-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tokyo Trip"
              maxLength={120}
              required
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="plan-tz">Time zone</Label>
            <Select value={timezone} onValueChange={setUserTz}>
              <SelectTrigger id="plan-tz" className="w-full">
                <SelectValue placeholder="Select a time zone" />
              </SelectTrigger>
              <SelectContent>
                {timezones.map((tz) => (
                  <SelectItem key={tz} value={tz}>
                    {tz}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending || !name.trim() || !timezone}
            >
              {isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
