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
- `AutoFillButton` component in the editor top bar: primary variant when plan is dirty, outlined when not, disabled while running.
- Dirty tracking:
  - Whenever a mutation action runs (`updateEvent`, `updateTravel`, `setDayLodging`, etc.), set `plans.dirtySince = now()`.
  - Whenever `runAutoFill` completes, set `plans.dirtySince = null`.
  - Button reads `dirtySince` to pick its label.
- Progress indication: button shows a spinner + "Filling…" while running; on completion, a toast summarizes issue / warning counts derived from the returned `alerts`.
- Error handling: route / Google failures are folded into the returned `alerts` as `cascade_unresolved` entries on the offending Travel (happens inside the engine, per `0011`) — no separate error channel. The UI renders them through the usual `AlertPanel` refresh after `updateTag`.

**Out:**
- Released page or PDF (`0013`, `0015`).
- An undo button (not in v1; cascade result is derived so the user can re-edit).

## Schema / types

Schema — add a column to `plans`:
```ts
dirtySince: timestamp('dirty_since', { withTimezone: true }).defaultNow()
```

Nullable (no `.notNull()`) — `runAutoFill` clears it to `null` on success; non-null means dirty. `.defaultNow()` makes freshly-created plans born dirty (matches UX intent: never-filled plans should show "Auto Fill" primary). Migration via `drizzle-kit generate`; Postgres applies the default to existing rows at `ALTER TABLE` time, so no hand-edited backfill is needed.

Action types (`src/actions/autofill.ts`):
```ts
RunAutoFillInput = { planId: string }
RunAutoFillResult = {
  alerts: Alert[];
};
```

Matches the engine's `runAutoFillForPlan(planId): Promise<{ alerts: Alert[] }>` shape (established in `0011`). Counts of what got filled are not returned explicitly — the toast reads the alert set (e.g. "Auto Fill complete · 2 issues, 1 warning") and the UI re-reads the cached plan after `updateTag`. If we later want "Filled N events" copy, widen the engine to return persisted-id arrays; not needed for v1.

Route failures (no-route, Google upstream errors) are already folded into `alerts` by the engine as `cascade_unresolved` entries on the offending Travel, so there is no separate `errors` field.

## Files

Create:
- `src/actions/autofill.ts`
- `src/components/editor/AutoFillButton.tsx`
- `src/lib/plans/markDirty.ts`

Modify:
- `src/db/schema.ts` — add `dirtySince`.
- `src/actions/events.ts`, `travels.ts`, `days.ts`, `places.ts` — every mutation sets `dirtySince = now()` on the owning plan (via the `markPlanDirty` helper).
- `src/app/plans/[planId]/edit/layout.tsx` — replace the disabled `Auto Fill` placeholder in the Topbar (server component) with `<AutoFillButton planId={planId} isDirty={plan?.dirtySince != null} />`. The Topbar already calls `getPlan(planId)` — `EditorShell` is **not** touched.
- `src/lib/model/plans.ts` — no code change needed. `getPlan(id)` returns `typeof schema.plans.$inferSelect`, so the schema change in `src/db/schema.ts` auto-propagates `dirtySince` through the cached read.

## Implementation notes

- **Action shape** —
  ```ts
  'use server'
  import { updateTag } from 'next/cache';
  import { eq } from 'drizzle-orm';
  import { db, schema } from '@/db';
  import { err, ok, type Result, zodErr } from '@/lib/actions';
  import { runAutoFillForPlan } from '@/lib/autofill/engine';

  export async function runAutoFill(
    input: RunAutoFillInput,
  ): Promise<Result<RunAutoFillResult>> {
    const parsed = RunAutoFillInputSchema.safeParse(input);
    if (!parsed.success) return err(zodErr(parsed.error));
    const { planId } = parsed.data;

    const { alerts } = await runAutoFillForPlan(planId);
    await db.update(schema.plans).set({ dirtySince: null }).where(eq(schema.plans.id, planId));
    updateTag(`plan:${planId}`);
    return ok({ alerts });
  }
  ```
  The engine is pure `{ alerts }` in/out; `updateTag` is this action's responsibility (the engine cannot call it — `updateTag` is Server-Action-scoped in Next 16). Follow `implementation.md` §6 conventions: `safeParse` + `Result` + `updateTag`. The engine folds Google / route failures into `alerts` rather than throwing, so there's no `throw` to catch past the action boundary.
- **Dirty tracking** — consolidate into a helper `markPlanDirty(planId)` in `src/lib/plans/markDirty.ts`, imported and awaited from every mutation action before the existing `updateTag`. Cheap: a single UPDATE. Alternative (deferred): driven by a DB trigger — not worth the complexity in v1. **`plans.ts` mutations are intentionally skipped** — rename / duplicate / timezone rebase don't invalidate derived data in a way that demands a fresh Auto Fill.
- **Button UX** —
  - Dirty state (`dirtySince != null`) → "Auto Fill" in primary (`variant="default"`).
  - Clean state (`dirtySince == null`) → "Auto Fill again" in outlined (`variant="outline"`).
  - Running → spinner + "Filling…", disabled.
  - On success → toast "Auto Fill complete · N issues, M warnings" (counts derived from the returned `alerts`). `AlertPanel` re-renders from the cached read invalidated by `updateTag`.
- **Guardrails** — debounce double-clicks; disable while a previous run is in flight.
- **Cache invalidation** — action updates `plan:${planId}` via `updateTag`; editor refreshes via the cached model layer.
- **No auto-triggers** — per product §5.6, Auto Fill is explicit only. Do **not** hook it into mutation actions.
- **Long runs** — for a 5-day trip with 4 events/day, we're doing ~25 Directions calls worst case (mostly cached). Target p95 < 3s. If we ever blow past that, wrap in a streaming response (Next 16 supports streamed Server Actions) and incrementally surface progress. Skip for v1.

## Verification

1. Open editor with a plan where you've added 3 events and picked vehicles but no travel times. Click "Auto Fill" → button shows spinner → within ~2s it settles; travel rows now display `travelTime` and Map shows polylines.
2. Cascade: type `09:00` on Event 1 start, `17:00` on Event 3 start, leave Event 2 blank → Auto Fill → Event 2 inherits a start time that makes the math work; if gap is wide enough, Event 2 gets a `stayDuration` too; if not computable, an Issue appears.
3. Lock respected: type a deliberately wrong start time (`23:00`) on an Event — run Auto Fill → start time stays `23:00`; cascade emits a `cascade_unresolved` or `event_outside_hours` Alert.
4. Re-run Auto Fill when nothing has changed → toast shows the same alert counts as the prior run; cascade produces zero event writes and Google requests all serve from cache (verify via `[places/details] cache hit` / `[directions] cache hit` server logs — no upstream calls).
5. Edit any field → `plans.dirtySince` becomes non-null; button flips to "Auto Fill" primary. After running, button flips back to "Auto Fill again" outlined.
6. Simulate Google Directions failure (temporarily make `getOrComputeDirections` throw) → run Auto Fill → toast still fires with the updated issue count; the `AlertPanel` lists a `cascade_unresolved` alert on the offending Travel ("Route unavailable…"); other Travels still fill. Restore.
7. Two tabs racing: tab A edits event, tab B clicks Auto Fill → tab A's subsequent save triggers a conflict; Table view reconciles; no data loss (last-write-wins, documented in `0006`).
