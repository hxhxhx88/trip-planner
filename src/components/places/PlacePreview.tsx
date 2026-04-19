"use client";

import { ImageOff } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import type { PlaceHours, PlacePhoto } from "@/lib/schemas";

type Props = {
  place: {
    googlePlaceId: string;
    name: string;
    address: string | null;
    category: string | null;
    photos: PlacePhoto[];
    hours: PlaceHours | null;
    hoursSource?: "google" | "override";
  } | null;
  loading?: boolean;
};

export function PlacePreview({ place, loading }: Props) {
  if (loading || !place) {
    return (
      <div className="flex gap-3">
        <div className="h-20 w-20 shrink-0 animate-pulse rounded bg-muted" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
          <div className="h-3 w-full animate-pulse rounded bg-muted" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
        </div>
      </div>
    );
  }

  const todaySummary = describeTodayHours(place.hours);

  return (
    <div className="flex gap-3">
      <PhotoThumb
        key={place.googlePlaceId}
        placeId={place.googlePlaceId}
        hasPhoto={place.photos.length > 0}
      />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="truncate font-medium">{place.name}</div>
        {place.address ? (
          <div className="line-clamp-2 text-xs text-muted-foreground">
            {place.address}
          </div>
        ) : null}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {place.category ? <span>{place.category}</span> : null}
          {place.category && todaySummary ? <span>·</span> : null}
          {todaySummary ? <span>{todaySummary}</span> : null}
          {place.hoursSource === "override" ? (
            <Badge variant="secondary" className="ml-1">
              override
            </Badge>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function PhotoThumb({
  placeId,
  hasPhoto,
}: {
  placeId: string;
  hasPhoto: boolean;
}) {
  const [broken, setBroken] = useState(false);
  if (!hasPhoto || broken) {
    return (
      <div className="flex size-20 shrink-0 items-center justify-center rounded bg-muted text-muted-foreground">
        <ImageOff className="size-5" />
      </div>
    );
  }
  return (
    <div className="size-20 shrink-0 overflow-hidden rounded bg-muted">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/api/places/photo/${placeId}/0`}
        alt=""
        className="size-full object-cover"
        onError={() => setBroken(true)}
      />
    </div>
  );
}

function describeTodayHours(hours: PlaceHours | null): string | null {
  if (!hours || hours.weekly.length === 0) return null;
  const today = new Date().getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6;
  const entry = hours.weekly.find((w) => w.weekday === today);
  if (!entry) return "Closed today";
  return `Open ${entry.open}–${entry.close}`;
}
