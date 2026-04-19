import { getDay, parseISO } from "date-fns";

import type { PlanForEditor } from "@/lib/model/plan";
import type { Alert, PlaceHours } from "@/lib/schemas";
import { hhmmToMinutes, minutesToHhmm } from "@/lib/time";

const VEHICLE_THRESHOLD_MIN: Record<string, number> = {
  walk: 45,
  cycle: 60,
  drive: 90,
  transit: 120,
};

type Day = PlanForEditor["days"][number];
type DayEvent = PlanForEditor["events"][number];
type DayTravel = PlanForEditor["travels"][number];
type PlaceMap = PlanForEditor["places"];

export function validate(plan: PlanForEditor): Alert[] {
  const alerts: Alert[] = [];
  alerts.push(...validateDuplicateDates(plan.days));
  for (const day of plan.days) {
    alerts.push(...validateDayLodging(day));
    const dayEvents = plan.events
      .filter((e) => e.dayId === day.id)
      .slice()
      .sort((a, b) => a.position - b.position);
    const dayTravels = plan.travels
      .filter((t) => t.dayId === day.id)
      .slice()
      .sort((a, b) => a.position - b.position);
    alerts.push(...validateEventPlaces(dayEvents));
    alerts.push(...validateTravelVehicles(dayTravels));
    alerts.push(...validateEventHours(day, dayEvents, plan.places));
    alerts.push(...validateOverlapsAndCascade(dayEvents, dayTravels));
    alerts.push(...validateTightAndGap(dayEvents, dayTravels));
    alerts.push(...validateLongTravels(dayTravels));
  }
  return dedupe(alerts);
}

function dedupe(alerts: Alert[]): Alert[] {
  const seen = new Set<string>();
  const out: Alert[] = [];
  for (const a of alerts) {
    const key = `${a.severity}|${a.code}|${a.entity.type}|${a.entity.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(a);
  }
  return out;
}

function validateDuplicateDates(days: Day[]): Alert[] {
  const byDate = new Map<string, Day[]>();
  for (const d of days) {
    const arr = byDate.get(d.date) ?? [];
    arr.push(d);
    byDate.set(d.date, arr);
  }
  const out: Alert[] = [];
  for (const [date, group] of byDate) {
    if (group.length < 2) continue;
    for (const d of group) {
      out.push({
        severity: "issue",
        code: "day_duplicate_date",
        entity: { type: "day", id: d.id },
        message: `Duplicate day date: ${date}`,
      });
    }
  }
  return out;
}

function validateDayLodging(day: Day): Alert[] {
  const out: Alert[] = [];
  if (day.startLodgingPlaceId == null) {
    out.push({
      severity: "issue",
      code: "day_missing_lodging",
      entity: { type: "day", id: day.id },
      message: "Day has no Lodging",
      hint: "Pick a place to anchor the day's start.",
    });
  }
  if (day.endLodgingPlaceId == null) {
    out.push({
      severity: "issue",
      code: "day_missing_end_lodging",
      entity: { type: "day", id: day.id },
      message: "Day has no end Lodging",
      hint: "Pick a place where the day ends.",
    });
  }
  return out;
}

function validateEventPlaces(events: DayEvent[]): Alert[] {
  const out: Alert[] = [];
  for (const e of events) {
    if (e.placeId != null) continue;
    out.push({
      severity: "issue",
      code: "event_missing_place",
      entity: { type: "event", id: e.id },
      message: "Event missing Place",
    });
  }
  return out;
}

function validateTravelVehicles(travels: DayTravel[]): Alert[] {
  const out: Alert[] = [];
  for (const t of travels) {
    if (t.vehicle != null) continue;
    out.push({
      severity: "issue",
      code: "travel_missing_vehicle",
      entity: { type: "travel", id: t.id },
      message: "Travel has no vehicle",
    });
  }
  return out;
}

type OpenPeriod = { openMin: number; closeMin: number };

function getOpenPeriods(
  hours: PlaceHours,
  dayDate: string,
): OpenPeriod[] | null {
  const exc = hours.exceptions?.find((e) => e.date === dayDate);
  if (exc) {
    if (exc.closed) return [];
    if (exc.open && exc.close) {
      return [normalizePeriod(exc.open, exc.close)];
    }
  }
  const weekday = getDay(parseISO(dayDate)) as 0 | 1 | 2 | 3 | 4 | 5 | 6;
  const entries = hours.weekly.filter((w) => w.weekday === weekday);
  if (entries.length === 0) return [];
  return entries.map((w) => normalizePeriod(w.open, w.close));
}

function normalizePeriod(open: string, close: string): OpenPeriod {
  const openMin = hhmmToMinutes(open);
  let closeMin = hhmmToMinutes(close);
  if (closeMin <= openMin) closeMin += 1440;
  return { openMin, closeMin };
}

function validateEventHours(
  day: Day,
  events: DayEvent[],
  places: PlaceMap,
): Alert[] {
  const out: Alert[] = [];
  for (const e of events) {
    if (!e.placeId) continue;
    const place = places[e.placeId];
    if (!place) continue;
    if (!place.hours) {
      out.push({
        severity: "warning",
        code: "place_hours_unknown",
        entity: { type: "event", id: e.id },
        message: `Hours not available for ${place.name}`,
      });
      continue;
    }
    if (!e.startTime) continue;
    const periods = getOpenPeriods(place.hours, day.date);
    if (periods === null) continue;
    const startMin = hhmmToMinutes(e.startTime);
    const candidates = [startMin, startMin + 1440];
    const matching = periods.find((p) =>
      candidates.some((s) => s >= p.openMin && s < p.closeMin),
    );
    if (!matching) {
      out.push({
        severity: "issue",
        code: "event_outside_hours",
        entity: { type: "event", id: e.id },
        message: formatOutsideHoursMessage(
          place.name,
          periods,
          startMin,
          e.startTime,
        ),
      });
      continue;
    }
    if (e.stayDuration != null) {
      const startCandidate =
        candidates.find((s) => s >= matching.openMin && s < matching.closeMin) ??
        startMin;
      const endCandidate = startCandidate + e.stayDuration;
      if (endCandidate > matching.closeMin) {
        const closeHhmm = minutesToHhmm(matching.closeMin % 1440);
        const endHhmm = minutesToHhmm(
          (startMin + e.stayDuration) % 1440,
        );
        out.push({
          severity: "issue",
          code: "event_closes_during",
          entity: { type: "event", id: e.id },
          message: `${place.name} closes at ${closeHhmm}; event ends ${endHhmm}`,
        });
      }
    }
  }
  return out;
}

function formatOutsideHoursMessage(
  name: string,
  periods: OpenPeriod[],
  arrivalMin: number,
  arrivalHhmm: string,
): string {
  if (periods.length === 0) {
    return `${name} is closed today; arrival ${arrivalHhmm}`;
  }
  const upcoming = periods
    .filter((p) => p.openMin > arrivalMin)
    .sort((a, b) => a.openMin - b.openMin);
  if (upcoming.length > 0) {
    const openHhmm = minutesToHhmm(upcoming[0].openMin % 1440);
    return `${name} opens at ${openHhmm}; arrival ${arrivalHhmm}`;
  }
  const lastClose = [...periods]
    .sort((a, b) => b.closeMin - a.closeMin)[0].closeMin;
  const closeHhmm = minutesToHhmm(lastClose % 1440);
  return `${name} closes at ${closeHhmm}; arrival ${arrivalHhmm}`;
}

function findTravelBetween(
  travels: DayTravel[],
  prevPos: number,
  nextPos: number,
): DayTravel | null {
  return (
    travels.find((t) => t.position > prevPos && t.position < nextPos) ?? null
  );
}

function validateOverlapsAndCascade(
  events: DayEvent[],
  travels: DayTravel[],
): Alert[] {
  const out: Alert[] = [];
  for (let i = 0; i < events.length - 1; i++) {
    const prev = events[i];
    const next = events[i + 1];
    const travel = findTravelBetween(travels, prev.position, next.position);
    if (!travel) continue;
    const prevStart = prev.startTime ? hhmmToMinutes(prev.startTime) : null;
    const nextStart = next.startTime ? hhmmToMinutes(next.startTime) : null;
    const prevDur = prev.stayDuration;
    const travelTime = travel.travelTime;
    const bothAnchored =
      prevStart != null && prevDur != null && nextStart != null;
    if (!bothAnchored) continue;
    if (travelTime == null) {
      out.push({
        severity: "issue",
        code: "cascade_unresolved",
        entity: { type: "travel", id: travel.id },
        message: "Travel time unresolved; cannot check cascade",
        hint: "Run Auto Fill to compute travel time.",
      });
      continue;
    }
    const arrival = prevStart + prevDur + travelTime;
    if (nextStart < arrival) {
      const arrivalHhmm = minutesToHhmm(arrival % 1440);
      out.push({
        severity: "issue",
        code: "events_overlap",
        entity: { type: "event", id: next.id },
        message: `Events overlap: arrives ${arrivalHhmm}, next starts ${next.startTime}`,
      });
    }
  }
  return out;
}

function validateTightAndGap(
  events: DayEvent[],
  travels: DayTravel[],
): Alert[] {
  const out: Alert[] = [];
  for (let i = 0; i < events.length - 1; i++) {
    const prev = events[i];
    const next = events[i + 1];
    const travel = findTravelBetween(travels, prev.position, next.position);
    if (!travel) continue;
    const prevStart = prev.startTime ? hhmmToMinutes(prev.startTime) : null;
    const nextStart = next.startTime ? hhmmToMinutes(next.startTime) : null;
    const prevDur = prev.stayDuration;
    const travelTime = travel.travelTime;
    if (
      prevStart == null ||
      nextStart == null ||
      prevDur == null ||
      travelTime == null
    )
      continue;
    const arrival = prevStart + prevDur + travelTime;
    const buffer = nextStart - arrival;
    if (buffer > 0 && buffer < 5) {
      out.push({
        severity: "warning",
        code: "travel_tight",
        entity: { type: "travel", id: travel.id },
        message: `Tight connection: ${buffer} min buffer`,
      });
    } else if (buffer > 60) {
      out.push({
        severity: "warning",
        code: "gap_long",
        entity: { type: "event", id: next.id },
        message: `${buffer} min gap before ${next.startTime}`,
      });
    }
  }
  return out;
}

function validateLongTravels(travels: DayTravel[]): Alert[] {
  const out: Alert[] = [];
  for (const t of travels) {
    if (!t.vehicle || t.travelTime == null) continue;
    const threshold = VEHICLE_THRESHOLD_MIN[t.vehicle];
    if (threshold == null) continue;
    if (t.travelTime > threshold) {
      out.push({
        severity: "warning",
        code: "travel_long",
        entity: { type: "travel", id: t.id },
        message: `Travel time ${t.travelTime} min exceeds ${threshold} min for ${t.vehicle}`,
      });
    }
  }
  return out;
}
