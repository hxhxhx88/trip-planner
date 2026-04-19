import Image from "next/image";
import { BedDouble, MapPin } from "lucide-react";

import type { PlanForEditor } from "@/lib/model/plan";
import type { Alert } from "@/lib/schemas";
import { cn } from "@/lib/utils";

type Props = {
  slot: "start" | "end";
  place: PlanForEditor["places"][string] | null;
  sameAsStart?: boolean;
  alerts: Alert[];
};

export function ReleasedLodgingCard({ slot, place, sameAsStart, alerts }: Props) {
  const label = slot === "start" ? "Start of day" : "End of day";
  const hasIssue = alerts.some((a) => a.severity === "issue");
  const hasWarning = alerts.some((a) => a.severity === "warning");

  if (!place) {
    return (
      <article
        className={cn(
          "rounded-xl border border-dashed bg-muted/20 p-4",
          (hasIssue || hasWarning) && "border-dashed",
        )}
      >
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <BedDouble className="size-4" />
          <span className="font-medium">{label}</span>
          {hasIssue || hasWarning ? (
            <span
              aria-label={hasIssue ? "issue alert" : "warning alert"}
              className={cn(
                "size-2 rounded-full",
                hasIssue ? "bg-red-500" : "bg-amber-500",
              )}
            />
          ) : null}
        </div>
        <p className="mt-2 text-sm text-muted-foreground">No lodging set.</p>
      </article>
    );
  }

  if (slot === "end" && sameAsStart) {
    return (
      <article className="rounded-xl border bg-muted/20 p-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <BedDouble className="size-4" />
          Returns to{" "}
          <span className="font-medium text-foreground">{place.name}</span>
        </div>
      </article>
    );
  }

  return (
    <article
      className={cn(
        "overflow-hidden rounded-xl border bg-card",
        slot === "start" ? "border-primary/30" : "border-muted",
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b bg-muted/30 px-4 py-2">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <BedDouble className="size-3.5" />
          {label}
        </div>
        {hasIssue || hasWarning ? (
          <span
            aria-label={hasIssue ? "issue alert" : "warning alert"}
            className={cn(
              "size-2 rounded-full",
              hasIssue ? "bg-red-500" : "bg-amber-500",
            )}
          />
        ) : null}
      </div>
      <div className="flex items-start gap-3 p-4">
        <LodgingThumb place={place} />
        <div className="min-w-0 flex-1">
          <h4 className="truncate text-base font-semibold">{place.name}</h4>
          {place.address ? (
            <p className="mt-1 flex items-start gap-1 text-sm text-muted-foreground">
              <MapPin className="mt-0.5 size-3.5 shrink-0" />
              <span className="line-clamp-2">{place.address}</span>
            </p>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function LodgingThumb({ place }: { place: PlanForEditor["places"][string] }) {
  if (place.photos.length === 0) {
    return (
      <div className="flex size-16 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <BedDouble className="size-5" />
      </div>
    );
  }
  return (
    <div className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-muted">
      <Image
        src={`/places/${place.googlePlaceId}/0.jpg`}
        alt={place.name}
        fill
        sizes="64px"
        className="object-cover"
      />
    </div>
  );
}
