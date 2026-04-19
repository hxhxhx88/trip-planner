# 0012 — Auto Fill action & UI

## Context

Bring the engine from `0011` into the editor. A single "Auto Fill" button in the editor header runs `runAutoFillForPlan`, persists derived fields, and refreshes the UI. The button reflects dirty-state: after any edit that could invalidate derived data, the label becomes "Auto Fill again".

Product §§5.6 (triggered by explicit button press; never implicit), 3 (state machine: Draft → Auto-filled → dirty).

## Prerequisites

- `0011` (engine).
- `0006` (editor toolbar exists).
- `0010` (Alerts rendered; they'll multiply after Auto Fill).

## Scope

**In:**
- Server action `runAutoFill(planId)` in `src/actions/autofill.ts`.
- `AutoFillButton` component in the editor top bar: primary state when plan is dirty, secondary when not, disabled while running.
- Dirty tracking:
  - Whenever a mutation action runs (`updateEvent`, `updateTravel`, `setDayLodging`, etc.), set `plans.dirtySince = now()`.
  - Whenever `runAutoFill` completes, set `plans.dirtySince = null`.
  - Button reads `dirtySince` to pick its label.
- Progress indication: button shows a spinner + text while running; on completion, a toast summarizes `{ filledEvents, filledTravels, alertCount }`.
- Error handling: per-Day errors are collected and rendered as a toast group; the action returns partial results so the UI can reflect what was filled.

**Out:**
- Released page or PDF (`0013`, `0015`).
- An undo button (not in v1; cascade result is derived so the user can re-edit).

## Schema / types

Schema — add a column to `plans`:
```ts
dirtySince: timestamp('dirty_since', { withTimezone: true })
```

Migration via `drizzle-kit generate`.

Action types (`src/actions/autofill.ts`):
```ts
RunAutoFillInput = { planId: string }
RunAutoFillResult = {
  filledEvents: number;
  filledTravels: number;
  alerts: Alert[];
  errors: Array<{ dayId: string; message: string }>;
};
```

## Files

Create:
- `/Users/xuhan/code/travel-tw/src/actions/autofill.ts`
- `/Users/xuhan/code/travel-tw/src/components/editor/AutoFillButton.tsx`

Modify:
- `/Users/xuhan/code/travel-tw/src/db/schema.ts` — add `dirtySince`.
- `/Users/xuhan/code/travel-tw/src/actions/events.ts`, `travels.ts`, `days.ts`, `places.ts` — every mutation sets `dirtySince = now()` on the owning plan.
- `/Users/xuhan/code/travel-tw/src/components/editor/EditorShell.tsx` — mount `AutoFillButton` in the top bar; pass `isDirty` from server prop.
- `/Users/xuhan/code/travel-tw/src/lib/model/plans.ts` — include `dirtySince` in `getPlan(id)`.

## Implementation notes

- **Action shape** —
  ```ts
  'use server'
  export async function runAutoFill(input: RunAutoFillInput): Promise<RunAutoFillResult> {
    const { planId } = RunAutoFillInputSchema.parse(input);
    const result = await engine.runAutoFillForPlan(planId);
    await db.update(plans).set({ dirtySince: null }).where(eq(plans.id, planId));
    updateTag(`plan:${planId}`);
    return result;
  }
  ```
  Wrapped so any thrown errors are caught and returned as `result.errors` instead; never throw past the action boundary.
- **Dirty tracking** — consolidate into a helper `markDirty(planId)` called from every mutation action. Cheap: a single UPDATE. Alternative (deferred): driven by a DB trigger — not worth the complexity in v1.
- **Button UX** —
  - Dirty state → "Auto Fill" in primary variant (blue).
  - Clean state → "Auto Fill again" in secondary (outlined).
  - Running → spinner + "Filling…", disabled.
  - On success → toast "Filled 3 events, 4 travels. 1 new warning." `AlertPanel` count updates automatically via cached read.
- **Guardrails** — debounce double-clicks; disable while a previous run is in flight.
- **Cache invalidation** — action updates `plan:${planId}` via `updateTag`; editor refreshes via the cached model layer.
- **No auto-triggers** — per product §5.6, Auto Fill is explicit only. Do **not** hook it into mutation actions.
- **Long runs** — for a 5-day trip with 4 events/day, we're doing ~25 Directions calls worst case (mostly cached). Target p95 < 3s. If we ever blow past that, wrap in a streaming response (Next 16 supports streamed Server Actions) and incrementally surface progress. Skip for v1.

## Verification

1. Open editor with a plan where you've added 3 events and picked vehicles but no travel times. Click "Auto Fill" → button shows spinner → within ~2s it settles; travel rows now display `travelTime` and Map shows polylines.
2. Cascade: type `09:00` on Event 1 start, `17:00` on Event 3 start, leave Event 2 blank → Auto Fill → Event 2 inherits a start time that makes the math work; if gap is wide enough, Event 2 gets a `stayDuration` too; if not computable, an Issue appears.
3. Lock respected: type a deliberately wrong start time (`23:00`) on an Event — run Auto Fill → start time stays `23:00`; cascade emits a `cascade_unresolved` or `event_outside_hours` Alert.
4. Re-run Auto Fill when nothing has changed → toast says "0 changes"; no DB writes (check via server log count).
5. Edit any field → `plans.dirtySince` becomes non-null; button flips to "Auto Fill" primary. After running, button flips back to "Auto Fill again" secondary.
6. Simulate Google Directions failure (temporarily point `/api/directions` to return 500) → run Auto Fill → error toast names the offending Travel; other Travels still fill. Restore.
7. Two tabs racing: tab A edits event, tab B clicks Auto Fill → tab A's subsequent save triggers a conflict; Table view reconciles; no data loss (last-write-wins, documented in `0006`).
