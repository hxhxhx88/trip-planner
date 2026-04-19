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
  - Start lodging row (read-only, wired by `0004`).
  - For each Event at position `p`: a Travel row with `position = p - 0.5` (or pre-event), an Event row.
  - End lodging row.
- Event row columns: Time (start), Duration (minutes), Place, Description (textarea), Remark (textarea), Alert indicator (empty until `0010`), actions (Move up / Move down / Remove).
- Travel row columns: Vehicle (select: walk/drive/transit/cycle), Travel time (computed display, editable-override later via `0012` flow), Alert indicator, (no actions — travels are implicit).
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
- `AddEventInput = { planId, dayId, afterEventId?: string }` — inserts at position after given (or at end if omitted).
- `UpdateEventInput = { planId, id, patch: Partial<EditableEventFields> }`
- `RemoveEventInput = { planId, id }`
- `MoveEventInput = { planId, id, direction: 'up'|'down' }`
- `UpdateTravelInput = { planId, id, patch: Partial<EditableTravelFields> }`

Where:
- `EditableEventFields = { placeId, startTime, stayDuration, description, remark }`
- `EditableTravelFields = { vehicle }` (travel time/route are only set via Auto Fill in `0012`)

## Files

Create:
- `src/actions/events.ts`
- `src/actions/travels.ts`
- `src/components/editor/TableView.tsx`
- `src/components/editor/EventRow.tsx`
- `src/components/editor/TravelRow.tsx`
- `src/components/editor/LodgingRow.tsx`
- `src/components/editor/VehicleSelect.tsx`
- `src/components/editor/AddEventButton.tsx`
- `src/lib/model/day.ts` — `getDayComposition(dayId)` returning interleaved rows as a single array.

Modify:
- `src/components/editor/EditorShell.tsx` — mount `TableView` in the right pane for the current Day.
- `src/lib/model/plan.ts` — ensure `getPlanForEditor` includes events and travels.

## Implementation notes

- **Interleaving** — source of truth is two ordered lists (`events`, `travels`) indexed by `position`. When we render, we interleave client-side; the server never stores the flat sequence. Use positions like 100, 200, 300 (sparse) so moves can happen without re-indexing; periodically rebalance if gaps grow.
- **Travel invariant** — for N events, there are N+1 travels per day (including from start-lodging and to end-lodging). `addEvent` creates the new event and, if needed, splits the existing travel that "bridged" its slot into two travels. `removeEvent` reverses — the two adjacent travels merge into one (we keep the earlier one, drop the later; user picks vehicle again if they mismatch).
- **`useOptimistic` scope** — `TableView` wraps the list of rows in a reducer that handles `add`, `remove`, `move`. Field edits are NOT optimistic; they use local controlled state per field and let the server response (via `updateTag` + `refresh`) be the reconciler.
- **Debouncing** — each field has a `useDebouncedCallback(action, 300)` that fires after idle. On submit Enter: flush immediately.
- **15-min rounding** — on blur, `roundToQuarter(hhmmToMinutes(value))` and re-render (helpers from `src/lib/time.ts`). Invalid input (e.g. 25:00) rolls back to last committed value.
- **Locked fields** — server action accepts a patch; for each field in the patch, add its name to `lockedFields` (dedupe). Never remove from `lockedFields` unless the field is explicitly cleared (value → null) *and* user is confirming via a small "Unlock" action (v1 keeps it simple: clearing a value keeps it locked with null; Auto Fill still won't overwrite). This is consistent with §8 resolution: "user typed a value = lock".
- **Concurrent-edit `router.refresh`** — the action returns `{ updatedAt }`; the client compares to the `updatedAt` it knew before sending. If newer than expected (some other tab wrote between your fetch and your mutation), we call `router.refresh()` so the UI re-pulls, and show a subtle toast ("Merged changes from another tab").
- **Move up/down** — swap positions of adjacent (event, event); the travels between them don't need to move — they just find new adjacent events via position ordering. Simpler than a full reorder algorithm.
- **Keyboard** — Tab traverses Time → Duration → Place → Description → Remark. Enter in a field submits; Shift+Enter in a textarea inserts a newline.
- **`getDayComposition`** — returns a single, position-sorted array of `{ kind: 'lodging-start'|'travel'|'event'|'lodging-end', data }`. Both Table and Timeline (`0008`) consume it.

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
