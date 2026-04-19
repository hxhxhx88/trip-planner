"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  ArrowDown,
  ArrowUp,
  MapPin,
  MoreHorizontal,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { updateEvent } from "@/actions/events";
import { InlineMarker } from "@/components/alerts/InlineMarker";
import { PlacePicker } from "@/components/places/PlacePicker";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import type { PlaceDetails } from "@/lib/google/types";
import { useDebouncedCallback } from "@/lib/hooks";
import type { DayEvent } from "@/lib/model/day";
import type { PlanForEditor } from "@/lib/model/plan";
import type { Alert } from "@/lib/schemas";
import { minutesToHhmm, roundToQuarter } from "@/lib/time";
import { cn } from "@/lib/utils";

type Props = {
  planId: string;
  event: DayEvent;
  places: PlanForEditor["places"];
  canMoveUp: boolean;
  canMoveDown: boolean;
  selected: boolean;
  hovered: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  onSelect: () => void;
  onHover: (hovering: boolean) => void;
  registerRef?: (id: string, el: HTMLElement | null) => void;
  alerts: Alert[];
};

// CANONICAL HH:MM rule: accept ^(\d{1,2}):(\d{2})$ where h ≤ 23 and m ≤ 59.
// Single-digit hours OK (e.g. "9:30"); minutes must be two digits. Rounded to
// the nearest 15-min boundary on commit. Anything else rolls back to the last
// committed value.
function parseAndRoundTime(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(trimmed);
  if (!m) return "INVALID";
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return "INVALID";
  return minutesToHhmm(roundToQuarter(h * 60 + min));
}

function parseAndRoundDuration(raw: string): number | null | "INVALID" {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) return "INVALID";
  return roundToQuarter(Math.round(n));
}

export function EventRow({
  planId,
  event,
  places,
  canMoveUp,
  canMoveDown,
  selected,
  hovered,
  onMoveUp,
  onMoveDown,
  onRemove,
  onSelect,
  onHover,
  registerRef,
  alerts,
}: Props) {
  const router = useRouter();
  const isOptimistic = event.id.startsWith("opt-");

  // Local controlled values
  const [time, setTime] = useState(event.startTime ?? "");
  const [duration, setDuration] = useState(
    event.stayDuration != null ? String(event.stayDuration) : "",
  );
  const [description, setDescription] = useState(event.description ?? "");
  const [remark, setRemark] = useState(event.remark ?? "");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [savingField, setSavingField] = useState<string | null>(null);
  const savingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track the most recent updatedAt we know about so the server can detect
  // concurrent writes from other tabs.
  const lastKnownUpdatedAtRef = useRef<Date>(event.updatedAt);
  useEffect(() => {
    if (event.updatedAt.getTime() > lastKnownUpdatedAtRef.current.getTime()) {
      lastKnownUpdatedAtRef.current = event.updatedAt;
    }
  }, [event.updatedAt]);

  // Re-sync when the prop's source values change (e.g. another tab wrote).
  // Only overwrite if the user isn't actively focused on that field.
  const focusedRef = useRef<string | null>(null);
  useEffect(() => {
    if (focusedRef.current !== "time") setTime(event.startTime ?? "");
  }, [event.startTime]);
  useEffect(() => {
    if (focusedRef.current !== "duration")
      setDuration(event.stayDuration != null ? String(event.stayDuration) : "");
  }, [event.stayDuration]);
  useEffect(() => {
    if (focusedRef.current !== "description")
      setDescription(event.description ?? "");
  }, [event.description]);
  useEffect(() => {
    if (focusedRef.current !== "remark") setRemark(event.remark ?? "");
  }, [event.remark]);

  const flashSaving = (field: string) => {
    setSavingField(field);
    if (savingTimerRef.current) clearTimeout(savingTimerRef.current);
    savingTimerRef.current = setTimeout(() => setSavingField(null), 200);
  };
  useEffect(
    () => () => {
      if (savingTimerRef.current) clearTimeout(savingTimerRef.current);
    },
    [],
  );

  const save = async (
    field: string,
    patch: Parameters<typeof updateEvent>[0]["patch"],
  ) => {
    if (isOptimistic) return;
    const res = await updateEvent({
      planId,
      id: event.id,
      expectedUpdatedAt: lastKnownUpdatedAtRef.current,
      patch,
    });
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    lastKnownUpdatedAtRef.current = res.data.updatedAt;
    flashSaving(field);
    if (res.data.merged) {
      toast("Merged changes from another tab");
      router.refresh();
    }
  };

  const descriptionDebounce = useDebouncedCallback((value: string) => {
    void save("description", { description: value === "" ? null : value });
  }, 300);
  const remarkDebounce = useDebouncedCallback((value: string) => {
    void save("remark", { remark: value === "" ? null : value });
  }, 300);

  const commitTime = () => {
    focusedRef.current = null;
    const result = parseAndRoundTime(time);
    if (result === "INVALID") {
      setTime(event.startTime ?? "");
      return;
    }
    if (result === event.startTime) {
      // unchanged
      if (result !== time) setTime(result ?? "");
      return;
    }
    setTime(result ?? "");
    void save("time", { startTime: result });
  };

  const commitDuration = () => {
    focusedRef.current = null;
    const result = parseAndRoundDuration(duration);
    if (result === "INVALID") {
      setDuration(event.stayDuration != null ? String(event.stayDuration) : "");
      return;
    }
    if (result === event.stayDuration) {
      const display = result != null ? String(result) : "";
      if (display !== duration) setDuration(display);
      return;
    }
    setDuration(result != null ? String(result) : "");
    void save("duration", { stayDuration: result });
  };

  const onPlaceCommit = async (details: PlaceDetails) => {
    await save("place", { placeId: details.googlePlaceId });
  };

  const place = event.placeId ? places[event.placeId] : null;
  const [transitionPending, startTransition] = useTransition();

  const handleMove = (dir: "up" | "down") => {
    startTransition(() => {
      if (dir === "up") onMoveUp();
      else onMoveDown();
    });
  };

  return (
    <div
      ref={(el) => registerRef?.(event.id, el)}
      role="row"
      onClick={onSelect}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      className={cn(
        "grid items-start gap-2 border-l-2 border-transparent px-3 py-2 transition-colors",
        selected && "border-primary bg-primary/5",
        hovered && !selected && "bg-muted/30",
        isOptimistic && "opacity-60",
      )}
      style={{
        gridTemplateColumns:
          "64px 64px minmax(180px,1.2fr) minmax(180px,1.5fr) minmax(160px,1fr) 24px 72px",
      }}
    >
      <div role="cell" className="relative">
        <Input
          aria-label="Start time"
          inputMode="numeric"
          placeholder="hh:mm"
          value={time}
          disabled={isOptimistic}
          onChange={(e) => setTime(e.target.value)}
          onFocus={() => (focusedRef.current = "time")}
          onBlur={commitTime}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              (e.target as HTMLInputElement).blur();
            }
          }}
          className="h-8 px-2 text-sm tabular-nums"
        />
        {savingField === "time" ? <SavingDot /> : null}
      </div>

      <div role="cell" className="relative">
        <Input
          aria-label="Stay duration in minutes"
          inputMode="numeric"
          placeholder="min"
          value={duration}
          disabled={isOptimistic}
          onChange={(e) => setDuration(e.target.value)}
          onFocus={() => (focusedRef.current = "duration")}
          onBlur={commitDuration}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              (e.target as HTMLInputElement).blur();
            }
          }}
          className="h-8 px-2 text-sm tabular-nums"
        />
        {savingField === "duration" ? <SavingDot /> : null}
      </div>

      <div role="cell" className="relative">
        <PlacePicker
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          onCommit={onPlaceCommit}
          trigger={
            <button
              type="button"
              disabled={isOptimistic}
              className="flex w-full items-start gap-1.5 rounded-md border bg-background px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <MapPin className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1">
                {place ? (
                  <>
                    <span className="block truncate">{place.name}</span>
                    {place.address ? (
                      <span className="block truncate text-xs text-muted-foreground">
                        {place.address}
                      </span>
                    ) : null}
                  </>
                ) : (
                  <span className="text-muted-foreground">Pick a place…</span>
                )}
              </span>
            </button>
          }
        />
        {savingField === "place" ? <SavingDot /> : null}
      </div>

      <div role="cell" className="relative">
        <textarea
          aria-label="Description"
          placeholder="Description"
          value={description}
          disabled={isOptimistic}
          rows={1}
          onChange={(e) => {
            setDescription(e.target.value);
            descriptionDebounce.run(e.target.value);
          }}
          onFocus={() => (focusedRef.current = "description")}
          onBlur={() => {
            focusedRef.current = null;
            descriptionDebounce.flush();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              (e.target as HTMLTextAreaElement).blur();
            }
          }}
          className="block w-full resize-none rounded-md border bg-background px-2 py-1.5 text-sm focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
        />
        {savingField === "description" ? <SavingDot /> : null}
      </div>

      <div role="cell" className="relative">
        <textarea
          aria-label="Remark"
          placeholder="Remark"
          value={remark}
          disabled={isOptimistic}
          rows={1}
          onChange={(e) => {
            setRemark(e.target.value);
            remarkDebounce.run(e.target.value);
          }}
          onFocus={() => (focusedRef.current = "remark")}
          onBlur={() => {
            focusedRef.current = null;
            remarkDebounce.flush();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              (e.target as HTMLTextAreaElement).blur();
            }
          }}
          className="block w-full resize-none rounded-md border bg-background px-2 py-1.5 text-sm focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
        />
        {savingField === "remark" ? <SavingDot /> : null}
      </div>

      <div role="cell" className="flex items-center justify-center">
        <InlineMarker alerts={alerts} />
      </div>

      <div role="cell" className="flex items-center justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="size-8 p-0"
                disabled={isOptimistic || transitionPending}
              >
                <MoreHorizontal className="size-4" />
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              disabled={!canMoveUp}
              onClick={() => handleMove("up")}
            >
              <ArrowUp className="size-3.5" />
              Move up
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={!canMoveDown}
              onClick={() => handleMove("down")}
            >
              <ArrowDown className="size-3.5" />
              Move down
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onRemove} variant="destructive">
              <Trash2 className="size-3.5" />
              Remove
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

function SavingDot() {
  return (
    <span
      aria-label="saving"
      className="pointer-events-none absolute right-1 top-1 size-1.5 rounded-full bg-primary/70"
    />
  );
}
