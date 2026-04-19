# 0004 — Editor shell (split-pane, days, lodging)

## Context

The editor at `/plans/[planId]/edit` is the primary authoring surface. Product §5.8 mandates an always-on Map (left) alongside a right pane that toggles between Table and Timeline. A top-level Day selector switches the focused day. Each Day needs a Lodging. This sub-plan builds the shell — no Places search, no events, no map tiles yet — so we have a stable frame to hang content on.

Product §§5.2 (Day & Lodging), 5.8 (views).

## Prerequisites

- `0001`, `0003` (plans exist).

## Scope

**In:**
- `/plans/[planId]/edit` route with server component that composes plan + days + placeholders and hands off to client shell.
- `SplitPane` layout: fixed left (map placeholder, 50%), scrollable right (right-pane placeholder, 50%). Gutter is fixed-width; no resizable drag in v1.
- `DayTabs` at the top of the right pane: one tab per Day ordered by date, an "Add Day" button.
- `AddDayDialog`: date picker, disallows duplicate dates; warns on non-contiguous dates but does not block.
- Per-Day Lodging slots: `LodgingSlot` component with two picker placeholders (start, end). In `0005` these become real Place pickers; here they're disabled buttons reading "Pick lodging…".
- `deleteDay` action.
- Day-inherits-previous-Lodging default: when `addDay` runs and a previous day exists with lodging set, copy its `startLodgingPlaceId` and `endLodgingPlaceId` to the new day.
- Day selector also lives **at the top of the Map pane** (empty placeholder for now; actual Map arrives in `0007`). Both use the same `currentDayId` from the Zustand store (defined here, even though the Map subscribes later).
- Empty state: plan with zero days shows a centered "Add your first day" CTA inside the split-pane.

**Out:**
- Real Place picker (`0005`).
- Event rows (`0006`).
- Map rendering (`0007`).
- Timeline view (`0008`).
- Day reorder by drag — v1 uses dates to order automatically; no manual reorder.

## Schema / types

No new tables. Uses `days`.

Zustand selection store (`src/stores/selection.ts`):
```ts
type SelectionState = {
  currentDayId: string | null;
  selectedId: string | null;   // event/travel/lodging id of current focus
  hoveredId: string | null;
  setCurrentDay: (id: string) => void;
  select: (id: string | null) => void;
  hover: (id: string | null) => void;
};
```

Initialized once per plan; `currentDayId` defaults to the first day's id (computed in the server component and passed as prop to a client `SelectionHydrator`).

## Files

Create:
- `/Users/xuhan/code/travel-tw/src/app/plans/[planId]/edit/page.tsx`
- `/Users/xuhan/code/travel-tw/src/app/plans/[planId]/edit/layout.tsx` — optional; hold toolbar.
- `/Users/xuhan/code/travel-tw/src/components/editor/EditorShell.tsx` (client) — mounts `SplitPane`, `DayTabs`, `SelectionHydrator`.
- `/Users/xuhan/code/travel-tw/src/components/editor/SplitPane.tsx`
- `/Users/xuhan/code/travel-tw/src/components/editor/DayTabs.tsx`
- `/Users/xuhan/code/travel-tw/src/components/editor/AddDayDialog.tsx`
- `/Users/xuhan/code/travel-tw/src/components/editor/LodgingSlot.tsx` (placeholder wiring)
- `/Users/xuhan/code/travel-tw/src/components/editor/EmptyDay.tsx` — "Pick a lodging to start the day"
- `/Users/xuhan/code/travel-tw/src/stores/selection.ts`
- `/Users/xuhan/code/travel-tw/src/actions/days.ts` — `addDay`, `deleteDay`, `setDayLodging` (latter used by `0005`).
- `/Users/xuhan/code/travel-tw/src/lib/model/plan.ts` — `getPlanForEditor(planId)` returning the shape the editor renders (plan + days + events + travels + places looked up).

## Implementation notes

- **Async params** — `page.tsx` awaits `params` (Next 16 Promise). Do **not** destructure from `params` synchronously.
- **Server → client handoff** — `page.tsx` (server) calls `getPlanForEditor(planId)` (cached), passes JSON-serializable data to `EditorShell` (client). Don't pass Dates directly; ISO-serialize.
- **`getPlanForEditor`** — wrapped in `'use cache'`; `cacheTag(\`plan:\${planId}\`)` and `cacheTag(\`plans:index\`)` (latter so list rename reflects on editor). Args: `(planId)`. Do not read `params` inside the cached function.
- **Day ordering** — always by `date` ascending. The `days.position` column exists for future explicit ordering; for now, set it equal to the date-sorted index on insert and on delete run a re-index.
- **addDay** validation:
  - Zod: `{ planId, date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }`.
  - Reject if another day has that exact date (product §5.2: days are dated and ordered).
  - Accept non-contiguous dates; `AddDayDialog` shows a soft warning when the chosen date leaves a gap >= 2 days.
- **deleteDay** — cascade removes events and travels via FK. Re-index subsequent days' `position`.
- **SelectionHydrator** — small client component that on mount calls `useSelection.getState().setCurrentDay(initialDayId)`. Avoids hydration mismatch.
- **Split pane** — Tailwind grid: `grid-cols-[1fr_1fr]` with a `border-l` gutter. Left pane `overflow-hidden` (map fills it later); right pane is `overflow-auto`. `h-[calc(100vh-<topbar>)]` on the parent.
- **Top bar** in `layout.tsx`: plan name + back to `/` + quick link to settings + "Auto Fill" button (disabled until `0012`). Plus a "Release" button (disabled until `0013`).

## Verification

1. Create a plan at `/` → navigate to `/plans/[id]/edit`. Renders split-pane with empty-state CTA on the right, gray placeholder on the left.
2. Click "Add day" → pick today → first Day appears as a tab; right pane switches to its empty state with disabled Lodging buttons.
3. Add another Day with yesterday's date → validation rejects (same constraint class as duplicate; test duplicate too).
4. Add a Day **two weeks later** → soft warning shown; click-through adds the day. Day tab order is chronological.
5. Delete the middle day → tabs collapse; no orphan rows in DB (`\d events` shows no orphans).
6. Navigate away and back → the last-viewed Day does NOT persist (v1: always defaults to first). Note this in the verification.
7. Resize window → split stays 50/50; no horizontal scroll.
