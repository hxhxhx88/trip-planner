import type { Alert } from "@/lib/schemas";
import { hhmmToMinutes, minutesToHhmm } from "@/lib/time";

import type {
  CascadeResult,
  EventUpdate,
  ResolvedDay,
} from "./autofill/types";

type DayEvent = ResolvedDay["events"][number];
type DayTravel = ResolvedDay["travels"][number];

type Derived = {
  startTime?: number;
  stayDuration?: number;
  endTime?: number;
};

export function cascade(day: ResolvedDay): CascadeResult {
  const events = day.events.slice().sort((a, b) => a.position - b.position);
  const travels = day.travels.slice().sort((a, b) => a.position - b.position);

  const forward = runForward(events, travels);
  const backward = runBackward(events, travels);

  const updates: EventUpdate[] = [];
  const alerts: Alert[] = [];

  for (const event of events) {
    const fwd = forward.get(event.id);
    const bwd = backward.get(event.id);
    const update: EventUpdate = { id: event.id };
    let hasUpdate = false;

    const startCandidates = collectCandidates([
      fwd?.startTime,
      bwd?.startTime,
    ]);
    const durCandidates = collectCandidates([
      fwd?.stayDuration,
      bwd?.stayDuration,
    ]);

    if (fwd?.startTime != null && bwd?.endTime != null) {
      const combinedDur = bwd.endTime - fwd.startTime;
      if (combinedDur >= 0) {
        durCandidates.add(combinedDur);
      } else {
        alerts.push({
          severity: "issue",
          code: "cascade_unresolved",
          entity: { type: "event", id: event.id },
          message: `Cascade inconsistent: forward start ${minutesToHhmm(fwd.startTime)} is after backward end ${minutesToHhmm(bwd.endTime)}`,
        });
      }
    }

    if (event.startTime == null && !event.lockedFields.includes("startTime")) {
      const resolved = resolveCandidates(startCandidates);
      if (resolved.kind === "single") {
        update.startTime = minutesToHhmm(resolved.value);
        hasUpdate = true;
      } else if (resolved.kind === "conflict") {
        alerts.push({
          severity: "issue",
          code: "cascade_unresolved",
          entity: { type: "event", id: event.id },
          message: `Cannot resolve start time: forward ${toHhmmOrDash(fwd?.startTime)}, backward ${toHhmmOrDash(bwd?.startTime)}`,
        });
      }
    }

    if (
      event.stayDuration == null &&
      !event.lockedFields.includes("stayDuration")
    ) {
      const resolved = resolveCandidates(durCandidates);
      if (resolved.kind === "single") {
        update.stayDuration = resolved.value;
        hasUpdate = true;
      } else if (resolved.kind === "conflict") {
        const sorted = [...durCandidates].sort((a, b) => a - b);
        alerts.push({
          severity: "issue",
          code: "cascade_unresolved",
          entity: { type: "event", id: event.id },
          message: `Cannot resolve duration: candidates ${sorted.join(", ")} min`,
        });
      }
    }

    if (isBlank(event.description) && event.placeId) {
      const place = day.places[event.placeId];
      if (place?.category) {
        update.description = place.category;
        hasUpdate = true;
      }
    }

    if (hasUpdate) updates.push(update);
  }

  return { events: updates, travels: [], alerts };
}

function runForward(
  events: DayEvent[],
  travels: DayTravel[],
): Map<string, Derived> {
  const out = new Map<string, Derived>();
  const seedIdx = events.findIndex((e) => e.startTime != null);
  if (seedIdx < 0) return out;

  const seed = events[seedIdx];
  let propagatedEnd: number | null = null;
  const seedStart = hhmmToMinutes(seed.startTime!);
  if (seed.stayDuration != null) {
    propagatedEnd = seedStart + seed.stayDuration;
  }

  for (let i = seedIdx + 1; i < events.length; i++) {
    const prev = events[i - 1];
    const cur = events[i];
    const t = findTravelBetween(travels, prev.position, cur.position);

    let derivedStart: number | undefined;
    if (propagatedEnd != null && t?.travelTime != null) {
      derivedStart = propagatedEnd + t.travelTime;
      if (cur.startTime == null && !cur.lockedFields.includes("startTime")) {
        ensure(out, cur.id).startTime = derivedStart;
      }
    }

    const effectiveStart =
      cur.startTime != null ? hhmmToMinutes(cur.startTime) : derivedStart;
    if (effectiveStart != null && cur.stayDuration != null) {
      propagatedEnd = effectiveStart + cur.stayDuration;
      ensure(out, cur.id).endTime = propagatedEnd;
    } else {
      propagatedEnd = null;
    }
  }

  return out;
}

function runBackward(
  events: DayEvent[],
  travels: DayTravel[],
): Map<string, Derived> {
  const out = new Map<string, Derived>();
  let backSeedIdx = -1;
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i].startTime != null) {
      backSeedIdx = i;
      break;
    }
  }
  if (backSeedIdx < 0) return out;

  let pulledStart: number | null = hhmmToMinutes(
    events[backSeedIdx].startTime!,
  );

  for (let i = backSeedIdx - 1; i >= 0; i--) {
    const cur = events[i];
    const next = events[i + 1];
    const t = findTravelBetween(travels, cur.position, next.position);

    let derivedStart: number | undefined;
    if (pulledStart != null && t?.travelTime != null) {
      const derivedEnd = pulledStart - t.travelTime;
      ensure(out, cur.id).endTime = derivedEnd;

      if (
        cur.startTime != null &&
        cur.stayDuration == null &&
        !cur.lockedFields.includes("stayDuration")
      ) {
        const dur = derivedEnd - hhmmToMinutes(cur.startTime);
        if (dur >= 0) ensure(out, cur.id).stayDuration = dur;
      } else if (
        cur.startTime == null &&
        cur.stayDuration != null &&
        !cur.lockedFields.includes("startTime")
      ) {
        derivedStart = derivedEnd - cur.stayDuration;
        ensure(out, cur.id).startTime = derivedStart;
      }
    }

    const effectiveStart =
      cur.startTime != null ? hhmmToMinutes(cur.startTime) : derivedStart;
    pulledStart = effectiveStart ?? null;
  }

  return out;
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

function ensure(map: Map<string, Derived>, id: string): Derived {
  let entry = map.get(id);
  if (!entry) {
    entry = {};
    map.set(id, entry);
  }
  return entry;
}

function collectCandidates(values: Array<number | undefined>): Set<number> {
  const out = new Set<number>();
  for (const v of values) if (v != null) out.add(v);
  return out;
}

type Resolution =
  | { kind: "none" }
  | { kind: "single"; value: number }
  | { kind: "conflict" };

function resolveCandidates(candidates: Set<number>): Resolution {
  if (candidates.size === 0) return { kind: "none" };
  if (candidates.size === 1) return { kind: "single", value: [...candidates][0] };
  return { kind: "conflict" };
}

function toHhmmOrDash(value: number | undefined): string {
  return value == null ? "—" : minutesToHhmm(value);
}

function isBlank(value: string | null): boolean {
  return value == null || value.trim() === "";
}
