import type {
  TimelineItem,
  TimelineModel,
  TimelineUnscheduled,
} from "@/components/editor/timeline/types";
import {
  getDayComposition,
  type DayEvent,
  type DayRef,
  type DayTravel,
} from "@/lib/model/day";
import type { PlanForEditor } from "@/lib/model/plan";
import { VEHICLES, type Vehicle } from "@/lib/schemas";
import { hhmmToMinutes, minutesToHhmm } from "@/lib/time";

const DEFAULT_AXIS_START = 360; // 06:00
const DEFAULT_AXIS_END = 1440; // 24:00
const MIN_EVENT_HEIGHT_PX = 12;
const MIN_TRAVEL_SPAN_HEIGHT_PX = 2;
const CHIP_HEIGHT_PX = 16;

function isVehicle(v: string | null): v is Vehicle {
  return v !== null && (VEHICLES as readonly string[]).includes(v);
}

function labelAt(minutes: number): string {
  const normalized = ((minutes % 1440) + 1440) % 1440;
  return minutesToHhmm(normalized);
}

export function toTimelineModel({
  day,
  events,
  travels,
  places,
  pxPerMin = 0.5,
}: {
  day: DayRef;
  events: DayEvent[];
  travels: DayTravel[];
  places: PlanForEditor["places"];
  pxPerMin?: number;
}): TimelineModel {
  const composition = getDayComposition({ day, events, travels });
  const middle = composition.slice(1, -1);

  // Precompute event start/end minutes.
  const eventTimes = new Map<
    string,
    { startMin: number | null; endMin: number | null }
  >();
  for (const row of middle) {
    if (row.kind !== "event") continue;
    const e = row.data;
    const startMin = e.startTime ? hhmmToMinutes(e.startTime) : null;
    const endMin =
      startMin !== null && e.stayDuration !== null
        ? startMin + e.stayDuration
        : null;
    eventTimes.set(e.id, { startMin, endMin });
  }

  // Axis extends from rendered blocks only.
  let firstKnownStart: number | null = null;
  let lastKnownEnd: number | null = null;
  for (const t of eventTimes.values()) {
    if (t.startMin === null || t.endMin === null) continue;
    firstKnownStart =
      firstKnownStart === null
        ? t.startMin
        : Math.min(firstKnownStart, t.startMin);
    lastKnownEnd =
      lastKnownEnd === null ? t.endMin : Math.max(lastKnownEnd, t.endMin);
  }

  const axisStartMin = Math.min(DEFAULT_AXIS_START, firstKnownStart ?? DEFAULT_AXIS_START);
  const axisEndMin = Math.max(DEFAULT_AXIS_END, lastKnownEnd ?? DEFAULT_AXIS_END);
  const heightPx = Math.round((axisEndMin - axisStartMin) * pxPerMin);

  const yOf = (m: number) => Math.round((m - axisStartMin) * pxPerMin);

  const items: TimelineItem[] = [];
  const unscheduled: TimelineUnscheduled[] = [];

  // Lodging markers (always present, anchored to axis edges).
  const startPlace = day.startLodgingPlaceId
    ? (places[day.startLodgingPlaceId] ?? null)
    : null;
  items.push({
    kind: "lodging",
    id: `lodging-start:${day.id}`,
    anchor: "start",
    top: 0,
    time: labelAt(axisStartMin),
    label: startPlace?.name ?? null,
  });

  const endPlace = day.endLodgingPlaceId
    ? (places[day.endLodgingPlaceId] ?? null)
    : null;
  items.push({
    kind: "lodging",
    id: `lodging-end:${day.id}`,
    anchor: "end",
    top: heightPx,
    time: labelAt(axisEndMin),
    label: endPlace?.name ?? null,
  });

  // Identify outermost travels — these sit against lodging anchors (no time).
  const firstTravelIdx = middle.findIndex((r) => r.kind === "travel");
  let lastTravelIdx = -1;
  for (let i = middle.length - 1; i >= 0; i--) {
    if (middle[i].kind === "travel") {
      lastTravelIdx = i;
      break;
    }
  }

  for (let i = 0; i < middle.length; i++) {
    const row = middle[i];
    if (row.kind !== "event" && row.kind !== "travel") continue;

    if (row.kind === "event") {
      const e = row.data;
      const t = eventTimes.get(e.id);
      const placeName = e.placeId ? (places[e.placeId]?.name ?? null) : null;
      if (!t || t.startMin === null) {
        unscheduled.push({ kind: "event", id: e.id, placeName, reason: "no-start" });
        continue;
      }
      if (e.stayDuration === null || t.endMin === null) {
        unscheduled.push({ kind: "event", id: e.id, placeName, reason: "no-duration" });
        continue;
      }
      const top = yOf(t.startMin);
      const rawHeight = Math.round(e.stayDuration * pxPerMin);
      const height = Math.max(MIN_EVENT_HEIGHT_PX, rawHeight);
      items.push({
        kind: "event",
        id: e.id,
        top,
        height,
        startLabel: labelAt(t.startMin),
        endLabel: labelAt(t.endMin),
        placeName,
      });
      continue;
    }

    // row.kind === "travel"
    const tr = row.data;
    const vehicle = isVehicle(tr.vehicle) ? tr.vehicle : null;
    const travelTime = tr.travelTime;

    const isFirst = i === firstTravelIdx;
    const isLast = i === lastTravelIdx;

    const prevRow = i > 0 ? middle[i - 1] : null;
    const nextRow = i < middle.length - 1 ? middle[i + 1] : null;

    let prevEnd: number | null = null;
    let nextStart: number | null = null;
    if (prevRow?.kind === "event") {
      prevEnd = eventTimes.get(prevRow.data.id)?.endMin ?? null;
    }
    if (nextRow?.kind === "event") {
      nextStart = eventTimes.get(nextRow.data.id)?.startMin ?? null;
    }
    // Lodging has no time; treat those sides as unknown.
    if (isFirst) prevEnd = null;
    if (isLast) nextStart = null;

    if (prevEnd !== null && nextStart !== null) {
      const top = yOf(prevEnd);
      const rawHeight = yOf(nextStart) - top;
      const height = Math.max(MIN_TRAVEL_SPAN_HEIGHT_PX, rawHeight);
      items.push({
        kind: "travel",
        id: tr.id,
        top,
        height,
        vehicle,
        travelTime,
        status: "span",
      });
    } else if (prevEnd !== null || nextStart !== null) {
      const anchor = prevEnd !== null ? prevEnd : (nextStart as number);
      items.push({
        kind: "travel",
        id: tr.id,
        top: yOf(anchor),
        height: CHIP_HEIGHT_PX,
        vehicle,
        travelTime,
        status: "chip",
      });
    } else {
      unscheduled.push({
        kind: "travel",
        id: tr.id,
        vehicle,
        reason: "no-anchor",
      });
    }
  }

  return {
    dayId: day.id,
    axisStartMin,
    axisEndMin,
    pxPerMin,
    heightPx,
    items,
    unscheduled,
  };
}
