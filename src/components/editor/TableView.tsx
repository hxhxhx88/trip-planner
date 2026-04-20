"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useOptimistic,
  useRef,
  useTransition,
} from "react";
import { toast } from "sonner";

import { addEvent, moveEvent, removeEvent } from "@/actions/events";
import { AddEventButton } from "@/components/editor/AddEventButton";
import { EventRow } from "@/components/editor/EventRow";
import { LodgingRow } from "@/components/editor/LodgingRow";
import { TravelRow } from "@/components/editor/TravelRow";
import {
  getDayComposition,
  type DayEvent,
  type DayRow,
  type DayTravel,
} from "@/lib/model/day";
import type { PlanForEditor } from "@/lib/model/plan";
import type { Alert } from "@/lib/schemas";
import { useSelection } from "@/stores/selection";

type Props = {
  planId: string;
  day: PlanForEditor["days"][number];
  days: PlanForEditor["days"];
  events: PlanForEditor["events"];
  travels: PlanForEditor["travels"];
  places: PlanForEditor["places"];
  alertsByEntity: Record<string, Alert[]>;
};

type OptimisticAction =
  | { kind: "add"; optEventId: string; optTravelIds: string[] }
  | { kind: "remove"; eventId: string }
  | { kind: "move"; eventId: string; dir: "up" | "down" };

function blankEvent(id: string, dayId: string, position: number): DayEvent {
  return {
    id,
    dayId,
    position,
    placeId: null,
    startTime: null,
    stayDuration: null,
    description: null,
    remark: null,
    lockedFields: [],
    updatedAt: new Date(0),
  };
}
function blankTravel(id: string, dayId: string, position: number): DayTravel {
  return {
    id,
    dayId,
    position,
    vehicle: null,
    travelTime: null,
    transitSubtype: null,
    routePath: null,
    lockedFields: [],
    updatedAt: new Date(0),
  };
}

function reducer(state: DayRow[], action: OptimisticAction): DayRow[] {
  switch (action.kind) {
    case "add": {
      if (state.length < 2) return state; // safety
      const dayId =
        state.find((r) => r.kind === "event")?.data.dayId ??
        state.find((r) => r.kind === "travel")?.data.dayId;
      if (!dayId) return state;
      const lastEventPos = state
        .filter((r) => r.kind === "event")
        .reduce((m, r) => Math.max(m, (r.data as DayEvent).position), 0);
      const hasEvents = lastEventPos > 0;
      const newRows: DayRow[] = [];
      if (!hasEvents) {
        const [travelA, travelB] = action.optTravelIds;
        newRows.push({
          kind: "travel",
          data: blankTravel(travelA, dayId, 50),
        });
        newRows.push({
          kind: "event",
          data: blankEvent(action.optEventId, dayId, 100),
        });
        newRows.push({
          kind: "travel",
          data: blankTravel(travelB, dayId, 150),
        });
      } else {
        const newPos = lastEventPos + 100;
        newRows.push({
          kind: "event",
          data: blankEvent(action.optEventId, dayId, newPos),
        });
        newRows.push({
          kind: "travel",
          data: blankTravel(action.optTravelIds[0], dayId, newPos + 50),
        });
      }
      return [...state.slice(0, -1), ...newRows, state[state.length - 1]];
    }
    case "remove": {
      const idx = state.findIndex(
        (r) => r.kind === "event" && r.data.id === action.eventId,
      );
      if (idx === -1) return state;
      const next = state.filter((_, i) => i !== idx && i !== idx + 1);
      const hasEvents = next.some((r) => r.kind === "event");
      if (!hasEvents) {
        return [next[0], next[next.length - 1]];
      }
      return next;
    }
    case "move": {
      const idx = state.findIndex(
        (r) => r.kind === "event" && r.data.id === action.eventId,
      );
      if (idx === -1) return state;
      const step = action.dir === "up" ? -1 : 1;
      let neighborIdx = idx + step;
      while (
        neighborIdx >= 0 &&
        neighborIdx < state.length &&
        state[neighborIdx].kind !== "event"
      ) {
        neighborIdx += step;
      }
      if (
        neighborIdx < 0 ||
        neighborIdx >= state.length ||
        state[neighborIdx].kind !== "event"
      ) {
        return state;
      }
      const next = [...state];
      [next[idx], next[neighborIdx]] = [next[neighborIdx], next[idx]];
      return next;
    }
  }
}

function findPrevDayLodging(
  current: PlanForEditor["days"][number],
  days: PlanForEditor["days"],
): string | null {
  const earlier = days
    .filter((d) => d.date < current.date)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  for (const d of earlier) {
    if (d.startLodgingPlaceId) return d.startLodgingPlaceId;
    if (d.endLodgingPlaceId) return d.endLodgingPlaceId;
  }
  return null;
}

function nextOptId(prefix: string): string {
  return `opt-${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function TableView({
  planId,
  day,
  days,
  events,
  travels,
  places,
  alertsByEntity,
}: Props) {
  const router = useRouter();
  const composition = getDayComposition({ day, events, travels });
  const [optimistic, dispatch] = useOptimistic<DayRow[], OptimisticAction>(
    composition,
    reducer,
  );
  const [pending, startTransition] = useTransition();

  const selectedId = useSelection((s) => s.selectedId);
  const hoveredId = useSelection((s) => s.hoveredId);
  const select = useSelection((s) => s.select);
  const hover = useSelection((s) => s.hover);

  const rowRefs = useRef(new Map<string, HTMLElement>());
  const registerRef = useCallback((id: string, el: HTMLElement | null) => {
    if (el) rowRefs.current.set(id, el);
    else rowRefs.current.delete(id);
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    const el = rowRefs.current.get(selectedId);
    if (el) el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedId]);

  const prevDayLodging = findPrevDayLodging(day, days);

  const eventCount = optimistic.filter((r) => r.kind === "event").length;
  const eventIndices: number[] = [];
  optimistic.forEach((r, i) => {
    if (r.kind === "event") eventIndices.push(i);
  });

  const handleAdd = () => {
    const optEventId = nextOptId("e");
    const optTravelIds = [nextOptId("t"), nextOptId("t")];
    startTransition(async () => {
      dispatch({ kind: "add", optEventId, optTravelIds });
      const res = await addEvent({ planId, dayId: day.id });
      if (!res.ok) toast.error(res.error.message);
    });
  };

  const handleRemove = (eventId: string) => {
    startTransition(async () => {
      dispatch({ kind: "remove", eventId });
      const res = await removeEvent({ planId, id: eventId });
      if (!res.ok) toast.error(res.error.message);
    });
  };

  const handleMove = (eventId: string, dir: "up" | "down") => {
    startTransition(async () => {
      dispatch({ kind: "move", eventId, dir });
      const res = await moveEvent({ planId, id: eventId, direction: dir });
      if (!res.ok) {
        toast.error(res.error.message);
        router.refresh();
      }
    });
  };

  const handleHoverCallback = useCallback(
    (id: string) => (h: boolean) => hover(h ? id : null),
    [hover],
  );

  return (
    <div role="table" className="flex flex-col gap-1">
      {optimistic.map((row, i) => {
        if (row.kind === "lodging-start") {
          const id = `lodging-start:${day.id}`;
          return (
            <LodgingRow
              key="lodging-start"
              id={id}
              planId={planId}
              dayId={day.id}
              slot="start"
              placeId={row.data.placeId}
              places={places}
              prevDayLodgingPlaceId={prevDayLodging}
              selected={selectedId === id}
              hovered={hoveredId === id}
              onSelect={() => select(id, "pane")}
              onHover={handleHoverCallback(id)}
              registerRef={registerRef}
              alerts={alertsByEntity[id] ?? []}
            />
          );
        }
        if (row.kind === "lodging-end") {
          const id = `lodging-end:${day.id}`;
          return (
            <LodgingRow
              key="lodging-end"
              id={id}
              planId={planId}
              dayId={day.id}
              slot="end"
              placeId={row.data.placeId}
              places={places}
              prevDayLodgingPlaceId={prevDayLodging}
              selected={selectedId === id}
              hovered={hoveredId === id}
              onSelect={() => select(id, "pane")}
              onHover={handleHoverCallback(id)}
              registerRef={registerRef}
              alerts={alertsByEntity[id] ?? []}
            />
          );
        }
        if (row.kind === "travel") {
          const id = row.data.id;
          return (
            <TravelRow
              key={id}
              planId={planId}
              travel={row.data}
              selected={selectedId === id}
              hovered={hoveredId === id}
              onSelect={() => select(id, "pane")}
              onHover={handleHoverCallback(id)}
              registerRef={registerRef}
              alerts={alertsByEntity[id] ?? []}
            />
          );
        }
        const eventOrdinal = eventIndices.indexOf(i);
        const id = row.data.id;
        return (
          <EventRow
            key={id}
            planId={planId}
            event={row.data}
            places={places}
            canMoveUp={eventOrdinal > 0}
            canMoveDown={eventOrdinal < eventCount - 1}
            selected={selectedId === id}
            hovered={hoveredId === id}
            onMoveUp={() => handleMove(id, "up")}
            onMoveDown={() => handleMove(id, "down")}
            onRemove={() => handleRemove(id)}
            onSelect={() => select(id, "pane")}
            onHover={handleHoverCallback(id)}
            registerRef={registerRef}
            alerts={alertsByEntity[id] ?? []}
          />
        );
      })}

      <div className="pt-2">
        <AddEventButton onAdd={handleAdd} disabled={pending} />
      </div>
    </div>
  );
}
