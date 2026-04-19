# 0008 — Timeline view

## Context

Product §5.8 specifies a right-pane Timeline as an alternative to the Table. The Timeline is best for seeing pacing and dead time. Events are blocks on a vertical hours axis; Travels are connectors; gaps (e.g. arriving early) are simply empty space. The toggle between Table and Timeline must preserve the currently-selected entity.

Product §§5.8 (Timeline), 4.3 (gap path).

## Prerequisites

- `0004` (editor shell).
- `0006` (`getDayComposition` from the Day model).

## Scope

**In:**
- `TimelineView` component rendering the current Day:
  - Vertical axis 06:00 → 24:00 by default (auto-extends to show all content).
  - Pixel-to-minute ratio: default 1px = 2min (30px = 1hour). Configurable via a prop for future density settings.
  - Event blocks: positioned by `startTime`, height by `stayDuration`; shows Place name, time range, and an empty `<span aria-label="alert slot">` next to the name that `0010` fills with `InlineMarker`.
  - Travel connectors: short line with vehicle icon and rounded travel-time label. If `routePath` / `travelTime` unknown, connector is a dashed line with "travel time TBD".
  - Empty space rendered as blank axis (no entity) — matches product §4.3.
  - Lodging markers at the axis top (start) and bottom (end).
- `ViewToggle` button pair (Table / Timeline) in the right pane header. Persists choice in `localStorage` per-plan.
- Selection continuity: current selected entity (from Zustand) is outlined in Timeline the same way as Table; toggle does not clear it.

**Out:**
- Map ↔ view sync (`0009` — but selection store is already used).
- Drag-to-resize Event blocks (not in v1).
- Alert rendering inside Events / Travels (`0010`).

## Schema / types

No new tables.

New types (`src/components/editor/timeline/types.ts`) — landed shape:
```ts
export type TimelineItem =
  | { kind: 'lodging'; id: string; time: string; label: string | null;
      anchor: 'start' | 'end'; top: number }
  | { kind: 'event'; id: string; top: number; height: number;
      startLabel: string; endLabel: string; placeName: string | null }
  | { kind: 'travel'; id: string; top: number; height: number;
      vehicle: Vehicle | null; travelTime: number | null;
      status: 'span' | 'chip' };

export type TimelineUnscheduled =
  | { kind: 'event'; id: string; placeName: string | null;
      reason: 'no-start' | 'no-duration' }
  | { kind: 'travel'; id: string; vehicle: Vehicle | null;
      reason: 'no-anchor' };

export type TimelineModel = {
  dayId: string;
  axisStartMin: number;      // may be < 360 when content escapes below
  axisEndMin: number;        // may be > 1440 when content crosses midnight
  pxPerMin: number;
  heightPx: number;
  items: TimelineItem[];
  unscheduled: TimelineUnscheduled[];
};
```

Positions computed from the Day composition by a pure builder
(`toTimelineModel` in `src/lib/model/timeline.ts`, mirroring the
`toMapDay` pattern from `0007`).

## Files

Create:
- `src/components/editor/TimelineView.tsx`
- `src/components/editor/timeline/EventBlock.tsx`
- `src/components/editor/timeline/TravelConnector.tsx`
- `src/components/editor/timeline/HoursAxis.tsx`
- `src/components/editor/timeline/UnscheduledPill.tsx`
- `src/components/editor/timeline/types.ts`
- `src/components/editor/ViewToggle.tsx`
- `src/lib/model/timeline.ts` — pure `toTimelineModel(...)` builder.

Modify:
- `src/components/editor/DayContent.tsx` — becomes `"use client"`; hosts
  `ViewToggle` in a flex header row next to the day title; swaps
  `<TableView/>` ↔ `<TimelineView/>` based on the persisted view.
- `src/lib/hooks.ts` — add `useLocalStorage<T extends string>(key, initial)`,
  SSR-safe via `useSyncExternalStore` (so sibling instances with the same key
  stay in sync automatically — useful for the keyboard shortcuts in `0016`).

## Implementation notes

- **Axis range** — compute min/max times from the Day's Events (start of first, end of last); clamp lower to `06:00` and upper to `24:00`; extend if content escapes. Render axis with hour-ticks and half-hour subticks.
- **Position math** — `top = (minutes - axisStart) * pxPerMin`; `height = duration * pxPerMin`. For events without start/duration, omit the block and render a small "unscheduled" pill at the bottom of the timeline grouped by day.
- **Travel connector** — from previous Event's end to next Event's start. If both are known, the connector spans exactly that range. If only one is known, show a small "computing" chip; do not try to compute the other (that's Auto Fill's job).
- **Empty space** — product §4.3 says a 30-min gap between `arrival_time` and next `start_time` is just blank. That's automatic from the math — the travel connector ends at `arrival`, the next event block starts later, and the space between is the empty axis.
- **Selection** — `selectedId` from Zustand; the matching block/connector gets a ring (Tailwind `ring-2 ring-primary`). Selecting in Timeline also writes to the store (hook into click handler).
- **Click to edit** — v1 Timeline is primarily read-only (pacing view). **Initial behavior (landed here):** clicking a block wrote the selection to Zustand and flipped the view to Table. **Superseded in `0009`:** the view flip is dropped; a Timeline click now just writes the selection, and the `ViewToggle` is the only thing that switches Table ↔ Timeline. Rationale: once the Map pans to the selected entity, yanking the user out of Timeline on every click defeats the point of inspecting pacing on the map. Double-click reserved for future inline edit.
- **ViewToggle state** — `useLocalStorage(`editor:view:${planId}`, 'table')` — per-plan key. Default `table`.
- **Empty days** — no events → Timeline shows only the two lodging markers (or placeholders) and an axis; no empty-state overlay.
- **Click-to-table persistence** — this 0008 behavior (click writes `'table'` to localStorage as well) was **removed by `0009`**: Timeline clicks no longer touch the view; `useLocalStorage(\`editor:view:${planId}\`)` is updated only through `ViewToggle`. Selection state still crosses the Table↔Timeline boundary via Zustand regardless.

## Verification

1. Plan with one Day, 3 Events with times and durations → Timeline shows 3 blocks at correct positions; Travels are connectors linking them.
2. Event 2 has no duration (blank) → its block is omitted; an "unscheduled" chip appears at the bottom listing Event 2.
3. Event 1 ends at 11:30, Event 2 starts at 12:30 → a 60-min gap is rendered as blank space; no visual artifact.
4. Toggle Table → Timeline → selected event's ring persists. Toggle back → same event still outlined; Table row remains focused.
5. Resize window → layout stays stable; axis density unchanged (no reflow).
6. Switch days → Timeline re-renders with new day's range and items.
7. Plan with Day spanning 05:00–01:00 (next day) → axis expands to show both; confirm no off-by-one near midnight.
