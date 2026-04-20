# 0006 — Events & Travels in the Table view

## Context

The Table view is the primary authoring surface (product §5.8). Events and Travels interleave: `Lodging → Travel → Event → Travel → Event → … → Travel → Lodging`. Users add, remove, and reorder Events; pick a Vehicle per Travel; type start times, stay durations, descriptions, remarks. Every user-typed value gets added to `locked_fields` so Auto Fill doesn't overwrite it.

Product §§5.4 (Events), 5.5 (Travels), 5.8 (Table), 6 (15-min rounding).

## Prerequisites

- `0001` (schema).
- `0005` (`PlacePicker`, `places` populated).

## Scope

**In:**
- `TableView` component — renders rows for the current Day:
  - Start lodging row (renders via `LodgingRow` wrapping the existing `LodgingSlot`).
  - For each Event at position `p`: a Travel row with integer `position = p - 50`, an Event row. Concretely: events at `100, 200, 300, …`; travels at `50, 150, 250, …` plus a trailing one at `last_event_pos + 50`. Sparse spacing so swaps and inserts don't re-index.
  - End lodging row.
- Event row columns: Time (start), Duration (minutes), Place, Description (textarea), Remark (textarea), Alert indicator (empty `role="cell"` slot here; filled by `InlineMarker` in `0010`), actions (Move up / Move down / Remove).
- Travel row columns: Vehicle (select: walk/drive/transit/cycle), Travel time (computed display, editable-override later via `0012` flow), Alert indicator (same empty slot, filled in `0010`), (no actions — travels are implicit).
- Inline field editing with local controlled state + debounced (300ms) server action. Per-field "saving…" pip for 200ms after last keystroke.
- `useOptimistic` for **row** ops: `addEvent`, `removeEvent`, `moveEvent(id, direction)`.
- 15-min rounding on time entry (both start time and duration): normalize on blur.
- Concurrent-edit reconciliation: compare server `updatedAt` on action response; if mismatch, `router.refresh()` silently.
- Server actions in `src/actions/events.ts` and `src/actions/travels.ts`.

**Out:**
- Map (`0007`).
- Timeline view (`0008`).
- Alerts (`0010`) — leave the Alert cell as an inert slot.
- Auto Fill (`0012`) — the "computed" travel time cell shows placeholder until then.

## Schema / types

No new tables. Uses existing `events`, `travels`.

New Zod schemas (in `src/actions/events.ts` / `travels.ts`):
- `AddEventInput = { planId, dayId }` — appends at end. (Mid-list insertion via `afterEventId` is deferred; the sparse position scheme makes it cheap to add later.)
- `UpdateEventInput = { planId, id, expectedUpdatedAt: Date, patch: Partial<EditableEventFields> }` → `Result<{ merged: boolean; updatedAt: Date }>`
- `RemoveEventInput = { planId, id }`
- `MoveEventInput = { planId, id, direction: 'up'|'down' }`
- `UpdateTravelInput = { planId, id, expectedUpdatedAt: Date, patch: Partial<EditableTravelFields> }` → `Result<{ merged: boolean; updatedAt: Date }>`

Where:
- `EditableEventFields = { placeId, startTime, stayDuration, description, remark }`
- `EditableTravelFields = { vehicle }` (travel time/route are only set via Auto Fill in `0012`; setting `vehicle` clears any existing `travelTime`/`routePath` so they get recomputed).

## Files

Create:
- `src/actions/events.ts`
- `src/actions/travels.ts`
- `src/components/editor/TableView.tsx`
- `src/components/editor/EventRow.tsx`
- `src/components/editor/TravelRow.tsx`
- `src/components/editor/LodgingRow.tsx` — thin row wrapper around `LodgingSlot`.
- `src/components/editor/VehicleSelect.tsx`
- `src/components/editor/AddEventButton.tsx`
- `src/lib/model/day.ts` — pure `getDayComposition({ day, events, travels })` returning a position-sorted `DayRow[]` of `{ kind: 'lodging-start'|'travel'|'event'|'lodging-end', data }`.
- `src/lib/hooks.ts` — `useDebouncedCallback(fn, ms)` returning `{ run, flush, cancel }`; auto-cancels on unmount.

Modify:
- `src/components/editor/DayContent.tsx` — replace inline lodging slots + `EmptyDay` with `<TableView />`.
- `src/components/editor/RightPane.tsx` — pass `events` and `travels` through to `DayContent`.
- `src/lib/model/plan.ts` — `getPlanForEditor` already returns events and travels; add `updatedAt` to each so the client can send `expectedUpdatedAt`.

Delete:
- `src/components/editor/EmptyDay.tsx` — superseded by `TableView`'s own empty state.

## Implementation notes

- **Interleaving** — source of truth is two ordered lists (`events`, `travels`) indexed by `position`. When we render, we interleave client-side; the server never stores the flat sequence. Use positions like 100, 200, 300 (sparse) so moves can happen without re-indexing; periodically rebalance if gaps grow.
- **Travel invariant** — for N events, there are N+1 travels per day (including from start-lodging and to end-lodging). `addEvent` creates the new event and, if needed, splits the existing travel that "bridged" its slot into two travels. `removeEvent` reverses — the two adjacent travels merge into one (we keep the earlier one, drop the later; user picks vehicle again if they mismatch).
- **`useOptimistic` scope** — `TableView` wraps the list of rows in a reducer that handles `add`, `remove`, `move`. Field edits are NOT optimistic; they use local controlled state per field and let the server response (via `updateTag` + `refresh`) be the reconciler.
- **Debouncing** — each field uses `const d = useDebouncedCallback(save, 300)`; call `d.run(value)` on change, `d.flush()` on Enter / blur, `d.cancel()` is auto-fired on unmount so optimistic-removed rows don't post stale writes.
- **15-min rounding** — time inputs accept `^(\d{1,2}):(\d{2})$` (single-digit hours OK; minutes must be two digits; rolls back if `h>23` or `m>59`); on blur, `minutesToHhmm(roundToQuarter(h*60+m))`. Duration uses `roundToQuarter(Number(value))`. Invalid input rolls back to the last committed value.
- **Locked fields** — a field is locked only while it holds a user-set value. The server action walks the patch: setting a non-null value adds the field name to `lockedFields` (dedupe); clearing a value to `null` removes it. So "user typed a value = lock", and clearing the field unlocks it and makes it eligible for Auto Fill again. Consistent with §8 resolution.
- **Concurrent-edit `router.refresh`** — field-edit actions take `expectedUpdatedAt: Date` in the input and return `Result<{ merged: boolean; updatedAt: Date }>`. The server compares `expectedUpdatedAt` to the row's current `updatedAt`, **always writes** (last-write-wins per the master plan), and sets `merged: true` when the values differ. Client always sends `lastKnownUpdatedAt` (initialised from prop, advanced on each successful save and from prop on revalidation). When `merged === true`, toast "Merged changes from another tab" and call `router.refresh()` so the UI re-pulls. Compare via `.getTime()` to avoid pg µs / JS ms precision drift. Row ops (`addEvent`, `removeEvent`, `moveEvent`) skip the check.
- **Move up/down** — swap positions of adjacent (event, event); the travels between them don't need to move — they just find new adjacent events via position ordering. Simpler than a full reorder algorithm.
- **Keyboard** — Tab traverses Time → Duration → Place → Description → Remark. Enter in a field submits; Shift+Enter in a textarea inserts a newline.
- **`getDayComposition`** — pure helper at `src/lib/model/day.ts`. Signature: `getDayComposition({ day, events, travels })` (callers pass the full `PlanForEditor` arrays; the helper filters by `dayId` internally). Returns a position-sorted `DayRow[]` of `{ kind: 'lodging-start'|'travel'|'event'|'lodging-end', data }`. Both Table (here) and Timeline (`0008`) consume it.

## Verification

1. In a plan with a Day, click "Add event" → row appears optimistically; server confirms; row persists on reload.
2. Type a start time `09:17` → blur → snaps to `09:15`.
3. Type a duration `45` → it sticks (45 is a multiple of 15). Type `50` → snaps to `45` (nearest). Type `53` → snaps to `45`.
4. Pick a Place via `PlacePicker` inside the row. `places` row exists; row shows place name.
5. Add a second Event → a Travel row now appears between them. Pick "walk" vehicle; DB `travels` row shows `vehicle='walk'`, `travelTime=null`, `routePath=null`.
6. Move second Event up → order swaps optimistically; DB confirms.
7. Remove an Event → the two adjacent Travels merge into one (lodging-to-next survives; verify a single travel row remains).
8. Two browser tabs, both open to the same Day: edit start_time in Tab A, then a description in Tab B → after Tab B's save, Tab A silently refreshes and shows both edits; toast in Tab B: "Merged changes from another tab".
9. Enter `9:30` (single digit hour) → parses to `09:30` or rolls back if ambiguous. Specify canonical behavior in the code comment.
10. Check `locked_fields` JSONB on the event after typing a `remark` → contains `"remark"`.
