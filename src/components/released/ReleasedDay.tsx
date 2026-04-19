import { parseISO } from "date-fns";

import { ReleasedAlerts } from "@/components/released/ReleasedAlerts";
import { ReleasedEventCard } from "@/components/released/ReleasedEventCard";
import { ReleasedFreeTime } from "@/components/released/ReleasedFreeTime";
import { ReleasedLodgingCard } from "@/components/released/ReleasedLodgingCard";
import { ReleasedTravelConnector } from "@/components/released/ReleasedTravelConnector";
import {
  getDayComposition,
  type DayEvent,
  type DayRow,
  type DayTravel,
} from "@/lib/model/day";
import type { PlanForEditor } from "@/lib/model/plan";
import type { Alert } from "@/lib/schemas";
import { hhmmToMinutes } from "@/lib/time";

type Props = {
  index: number;
  day: PlanForEditor["days"][number];
  events: DayEvent[];
  travels: DayTravel[];
  places: PlanForEditor["places"];
  dayAlerts: Alert[];
  alertsByEntity: Record<string, Alert[]>;
  firstDay?: boolean;
};

export function ReleasedDay({
  index,
  day,
  events,
  travels,
  places,
  dayAlerts,
  alertsByEntity,
  firstDay = false,
}: Props) {
  const rows = getDayComposition({ day, events, travels });
  const startPlace = day.startLodgingPlaceId
    ? (places[day.startLodgingPlaceId] ?? null)
    : null;
  const endPlace = day.endLodgingPlaceId
    ? (places[day.endLodgingPlaceId] ?? null)
    : null;
  const sameLodging =
    day.startLodgingPlaceId != null &&
    day.startLodgingPlaceId === day.endLodgingPlaceId;

  const middle = rows.slice(1, -1);

  const nodes: React.ReactNode[] = [];
  let eventOrdinal = 0;
  for (let i = 0; i < middle.length; i++) {
    const row = middle[i];
    if (row.kind === "event") {
      const event = row.data;
      const place = event.placeId ? (places[event.placeId] ?? null) : null;
      const preload = firstDay && eventOrdinal === 0;
      eventOrdinal += 1;
      nodes.push(
        <ReleasedEventCard
          key={`event-${event.id}`}
          event={event}
          place={place}
          alerts={alertsByEntity[event.id] ?? []}
          preload={preload}
        />,
      );
      continue;
    }
    if (row.kind === "travel") {
      const travel = row.data;
      nodes.push(
        <ReleasedTravelConnector
          key={`travel-${travel.id}`}
          travel={travel}
          alerts={alertsByEntity[travel.id] ?? []}
        />,
      );
      const prev = middle[i - 1] ?? null;
      const next = middle[i + 1] ?? null;
      const freeTime = computeFreeTime(prev, travel, next);
      if (freeTime != null && freeTime > 5) {
        nodes.push(
          <ReleasedFreeTime key={`free-${travel.id}`} minutes={freeTime} />,
        );
      }
    }
  }

  return (
    <section className="space-y-3" aria-labelledby={`day-${day.id}-title`}>
      <header className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Day {index + 1}
        </p>
        <h2
          id={`day-${day.id}-title`}
          className="text-xl font-semibold tracking-tight"
        >
          {formatDayHeader(day.date)}
        </h2>
      </header>

      <ReleasedAlerts alerts={dayAlerts} />

      <ReleasedLodgingCard
        slot="start"
        place={startPlace}
        alerts={alertsByEntity[`lodging-start:${day.id}`] ?? []}
      />

      {nodes}

      <ReleasedLodgingCard
        slot="end"
        place={endPlace}
        sameAsStart={sameLodging}
        alerts={alertsByEntity[`lodging-end:${day.id}`] ?? []}
      />
    </section>
  );
}

function computeFreeTime(
  prev: DayRow | null,
  travel: DayTravel,
  next: DayRow | null,
): number | null {
  if (!prev || prev.kind !== "event") return null;
  if (!next || next.kind !== "event") return null;
  const prevEvent = prev.data;
  const nextEvent = next.data;
  if (
    !prevEvent.startTime ||
    prevEvent.stayDuration == null ||
    !nextEvent.startTime ||
    travel.travelTime == null
  ) {
    return null;
  }
  const arrivalMin =
    hhmmToMinutes(prevEvent.startTime) +
    prevEvent.stayDuration +
    travel.travelTime;
  const startMin = hhmmToMinutes(nextEvent.startTime);
  return startMin - arrivalMin;
}

function formatDayHeader(date: string): string {
  const d = parseISO(date);
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}
