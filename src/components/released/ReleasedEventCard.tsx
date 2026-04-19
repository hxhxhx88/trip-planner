import Image from "next/image";
import { Clock, ImageOff, MapPin } from "lucide-react";

import type { DayEvent } from "@/lib/model/day";
import type { PlanForEditor } from "@/lib/model/plan";
import type { Alert } from "@/lib/schemas";
import { hhmmToMinutes, minutesToHhmm } from "@/lib/time";
import { cn } from "@/lib/utils";

type Props = {
  event: DayEvent;
  place: PlanForEditor["places"][string] | null;
  alerts: Alert[];
};

export function ReleasedEventCard({ event, place, alerts }: Props) {
  const hasIssue = alerts.some((a) => a.severity === "issue");
  const hasWarning = alerts.some((a) => a.severity === "warning");
  const timeLabel = formatTimeRange(event.startTime, event.stayDuration);

  return (
    <article className="overflow-hidden rounded-xl border bg-card shadow-sm">
      {place && place.photos.length > 0 ? (
        <div className="relative aspect-[16/10] w-full bg-muted">
          <Image
            src={`/places/${place.googlePlaceId}/0.jpg`}
            alt={place.name}
            fill
            sizes="(max-width: 448px) 100vw, 448px"
            className="object-cover"
          />
        </div>
      ) : place ? (
        <div className="flex aspect-[16/10] w-full items-center justify-center bg-muted text-muted-foreground">
          <ImageOff className="size-8" />
        </div>
      ) : null}

      <div className="space-y-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1 space-y-1">
            {timeLabel ? (
              <p className="flex items-center gap-1.5 text-sm font-medium tabular-nums">
                <Clock className="size-3.5 text-muted-foreground" />
                {timeLabel}
              </p>
            ) : null}
            <h3 className="text-lg font-semibold leading-tight">
              {place?.name ?? "Unplaced event"}
            </h3>
            {place?.address ? (
              <p className="flex items-start gap-1 text-sm text-muted-foreground">
                <MapPin className="mt-0.5 size-3.5 shrink-0" />
                <span className="line-clamp-2">{place.address}</span>
              </p>
            ) : null}
          </div>
          {hasIssue || hasWarning ? (
            <span
              aria-label={hasIssue ? "issue alert" : "warning alert"}
              className={cn(
                "mt-1 size-2.5 shrink-0 rounded-full",
                hasIssue ? "bg-red-500" : "bg-amber-500",
              )}
            />
          ) : null}
        </div>

        {event.description ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
            {event.description}
          </p>
        ) : null}

        {event.remark ? (
          <p className="whitespace-pre-wrap rounded-md border-l-2 border-primary/40 bg-muted/30 px-3 py-2 text-sm italic text-muted-foreground">
            {event.remark}
          </p>
        ) : null}
      </div>
    </article>
  );
}

function formatTimeRange(
  startTime: string | null,
  stayDuration: number | null,
): string | null {
  if (!startTime) return null;
  if (stayDuration == null) return startTime;
  const endMin = (hhmmToMinutes(startTime) + stayDuration) % 1440;
  return `${startTime} – ${minutesToHhmm(endMin)}`;
}
