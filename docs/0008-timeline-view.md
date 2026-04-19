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
  - Event blocks: positioned by `startTime`, height by `stayDuration`; shows Place name, time range, alert dot slot.
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

New types (`src/components/editor/timeline/types.ts`):
```ts
export type TimelineItem =
  | { kind: 'lodging'; id: string; time: string; label: string; anchor: 'start'|'end' }
  | { kind: 'event'; id: string; top: number; height: number; startLabel: string; endLabel: string; placeName: string }
  | { kind: 'travel'; id: string; top: number; height: number; vehicle: Vehicle | null; travelTime: number | null };
```

Positions computed from the Day composition.

## Files

Create:
- `/Users/xuhan/code/travel-tw/src/components/editor/TimelineView.tsx`
- `/Users/xuhan/code/travel-tw/src/components/editor/timeline/EventBlock.tsx`
- `/Users/xuhan/code/travel-tw/src/components/editor/timeline/TravelConnector.tsx`
- `/Users/xuhan/code/travel-tw/src/components/editor/timeline/HoursAxis.tsx`
- `/Users/xuhan/code/travel-tw/src/components/editor/timeline/types.ts`
- `/Users/xuhan/code/travel-tw/src/components/editor/ViewToggle.tsx`

Modify:
- `/Users/xuhan/code/travel-tw/src/components/editor/EditorShell.tsx` — render `ViewToggle` and switch between `TableView` / `TimelineView` in the right pane.

## Implementation notes

- **Axis range** — compute min/max times from the Day's Events (start of first, end of last); clamp lower to `06:00` and upper to `24:00`; extend if content escapes. Render axis with hour-ticks and half-hour subticks.
- **Position math** — `top = (minutes - axisStart) * pxPerMin`; `height = duration * pxPerMin`. For events without start/duration, omit the block and render a small "unscheduled" pill at the bottom of the timeline grouped by day.
- **Travel connector** — from previous Event's end to next Event's start. If both are known, the connector spans exactly that range. If only one is known, show a small "computing" chip; do not try to compute the other (that's Auto Fill's job).
- **Empty space** — product §4.3 says a 30-min gap between `arrival_time` and next `start_time` is just blank. That's automatic from the math — the travel connector ends at `arrival`, the next event block starts later, and the space between is the empty axis.
- **Selection** — `selectedId` from Zustand; the matching block/connector gets a ring (Tailwind `ring-2 ring-primary`). Selecting in Timeline also writes to the store (hook into click handler).
- **Click to edit** — v1 Timeline is primarily read-only (pacing view). Clicking a block switches back to Table and focuses that row. Double-click reserved for future inline edit.
- **ViewToggle state** — `useLocalStorage('editor:view', 'table')` with a per-plan key. Default `table`.
- **Empty days** — no events → Timeline shows only the two lodging markers (or placeholders) and an axis; no empty-state overlay.

## Verification

1. Plan with one Day, 3 Events with times and durations → Timeline shows 3 blocks at correct positions; Travels are connectors linking them.
2. Event 2 has no duration (blank) → its block is omitted; an "unscheduled" chip appears at the bottom listing Event 2.
3. Event 1 ends at 11:30, Event 2 starts at 12:30 → a 60-min gap is rendered as blank space; no visual artifact.
4. Toggle Table → Timeline → selected event's ring persists. Toggle back → same event still outlined; Table row remains focused.
5. Resize window → layout stays stable; axis density unchanged (no reflow).
6. Switch days → Timeline re-renders with new day's range and items.
7. Plan with Day spanning 05:00–01:00 (next day) → axis expands to show both; confirm no off-by-one near midnight.
