# 0011 — Auto Fill engine (backfill + cascade)

## Context

Auto Fill is the machine's moment to earn its keep. Given a plan where the human has specified *what* (places, ordering, anchor times, vehicles), it fills *derivable* fields: missing Place metadata, travel times and routes per Travel, cascaded start/end times, and default descriptions. It respects user locks (`lockedFields` — JSONB array of camelCase field names: `"startTime"`, `"stayDuration"`, `"description"`, `"placeId"`, `"remark"`, `"vehicle"`) and emits Alerts when the cascade fails. Product §5.6.

This sub-plan delivers the pure engine; `0012` wires it to a server action and UI button.

## Prerequisites

- `0002` (Places / Directions proxy + caches).
- `0010` (Alert shape).

## Scope

**In:**
- `src/lib/cascade.ts` — pure reducer. Given a `ResolvedDay`, returns `{ events: EventUpdate[], travels: TravelUpdate[], alerts: Alert[] }`. No I/O. In practice `travels` is always empty (backfill writes travel data directly); the field is kept for shape parity.
  - Forward cascade
  - Backward cascade
  - Merge with conflict detection
  - Respects `lockedFields`
  - Description defaulting (empty description → Place's primary category; never adds `"description"` to `lockedFields`)
- `src/lib/autofill/backfill.ts` — I/O-bound helper. For a `ResolvedDay`:
  1. For each place referenced by the day's events/lodging, call `getOrFetchPlaceDetails` (shared helper in `src/lib/google/places.ts`) which runs the 30-day-TTL cache check, fetches from Google if cold, and upserts `places` + `places_cache`.
  2. For each Travel that has a vehicle and lacks `travelTime`, resolve origin/dest via `getDayComposition` (event placeId, or lodging-start / lodging-end place for boundary travels), then call `getOrComputeDirections` (shared helper in `src/lib/google/directions.ts`) which runs the directions-cache check, calls Routes API if cold, rounds up to the next 15 min, and upserts `directions_cache`.
  3. Writes directions results back to the `travels` row (`travelTime`, `routePath`, `updatedAt`). Does not touch `lockedFields`.
  4. Returns `{ routeFailures: Array<{ travelId; reason }> }` for the engine to fold into alerts.
- `src/lib/autofill/engine.ts` — orchestrator: `runAutoFillForPlan(planId): Promise<{ alerts: Alert[] }>`. For each Day sequentially, calls `backfillDay` (which parallelizes place/direction fetches within the day); then re-reads the plan, runs `cascade` per day, persists updates; returns the deduped union of route-failure alerts, cascade alerts, and the final `validate(plan)` pass. Does **not** call `updateTag` — that's the caller's job (see 0012).
- Shared helpers in `src/lib/google/{places,directions}.ts` — `getOrFetchPlaceDetails(placeId)` and `getOrComputeDirections(origin, dest, vehicle)`. The existing route handlers (`src/app/api/places/details/route.ts`, `src/app/api/directions/route.ts`) are reduced to thin wrappers around these (plus their HTTP-layer error-to-status mapping and the `ensurePhoto` `after()` side-effect in places/details).
- Uncached loader `loadPlanForEditor(planId)` in `src/lib/model/plan.ts` alongside the existing cached `getPlanForEditor`. Engine reads via `loadPlanForEditor` so it can re-read mid-mutation without relying on `updateTag` (which is restricted to Server Action context per Next 16 docs).
- `dedupeAlerts` exported from `src/lib/validate.ts` for cross-source alert merging.

**Out:**
- Server action wiring + UI button (`0012`).
- Dirty-state indicator UX (`0012`).
- `updateTag('plan:${planId}')` invalidation (happens in the 0012 Server Action after `runAutoFillForPlan` returns).

## Schema / types

No new tables.

Types (`src/lib/autofill/types.ts`):
```ts
export type EventUpdate = {
  id: string;
  startTime?: string;       // HH:MM
  stayDuration?: number;    // minutes
  description?: string;     // only if currently empty
};
export type TravelUpdate = {
  id: string;
  travelTime?: number;
  routePath?: [number, number][];
};
export type CascadeResult = {
  events: EventUpdate[];
  travels: TravelUpdate[];
  alerts: Alert[];
};
```

## Files

Create:
- `src/lib/cascade.ts`
- `src/lib/autofill/backfill.ts`
- `src/lib/autofill/engine.ts`
- `src/lib/autofill/types.ts`

Modify (small refactor so backfill and route handlers share cache-aware I/O):
- `src/lib/google/places.ts` — add `getOrFetchPlaceDetails`, export `rowToDetails`.
- `src/lib/google/directions.ts` — add `getOrComputeDirections`.
- `src/app/api/places/details/route.ts` — thin wrapper around `getOrFetchPlaceDetails`; keeps the `ensurePhoto` `after()` side-effect.
- `src/app/api/directions/route.ts` — thin wrapper around `getOrComputeDirections`.
- `src/lib/model/plan.ts` — extract uncached inner `loadPlanForEditor`; `getPlanForEditor` becomes a cached wrapper that calls it.
- `src/lib/validate.ts` — export `dedupeAlerts`.

Wiring into the editor (Server Action, button, dirty state) happens in `0012`.

## Implementation notes

### Forward cascade

Start from the earliest time-anchored point in the Day (Event with `startTime` set, or Day start treated as Lodging departure at 00:00 — actually we need a better anchor: use the first Event that has a `startTime`, and walk forward from its `startTime + stayDuration`).

```
seed = first event with startTime
for i from seed to last:
  if event.endTime is computable (startTime + stayDuration), mark event.endTime resolved
  next_travel.departure = event.endTime
  if next_travel has travelTime: next_travel.arrival = departure + travelTime
  next_event.startTime = next_travel.arrival   # UNLESS next_event is locked
```

If a field is in `lockedFields`, skip setting it (but keep walking).

### Backward cascade

Symmetric: start from latest time-anchored event, walk up filling missing `endTime`, `stayDuration`, previous Travel durations.

### Merge

For each event, per field (`startTime`, `stayDuration`):
- Skip if the original value is non-null (cascade never overwrites).
- Skip if the field name is in `lockedFields`.
- If forward and backward both produced a candidate and they agree → apply.
- If only one side produced a candidate → apply.
- If both sides produced candidates and they disagree → emit `cascade_unresolved` on the event naming forward vs backward values; leave field blank.
- **Combined candidate for `stayDuration`**: when `forward.startTime` and `backward.endTime` both exist, add `backward.endTime - forward.startTime` to the duration candidates (this is how the canonical E1/E2/E3 demo resolves E2's duration — forward gives 09:45, backward gives 16:30, combined = 405 min).
- If no candidate and the field is null: **do not** emit `cascade_unresolved` here. Validate covers the narrow cases it can (see `validateOverlapsAndCascade` in `src/lib/validate.ts`); events left fully un-anchored fall through with no alert today — noted as a gap the next sub-plan may close.

### Description defaulting

For each Event with empty `description` and a resolved Place:
- Candidate: `category` (e.g. "Buddhist temple") or `name`'s type hint from Google's response.
- Set `description` to the candidate.
- Do NOT add to `lockedFields` — user-typed is what locks.

### Backfill details

- Call shared helpers `getOrFetchPlaceDetails` / `getOrComputeDirections` directly (no HTTP self-fetch). The same helpers back the public `/api/places/details` and `/api/directions` routes, so cache behavior (30-day TTL on place metadata, indefinite on directions) is identical.
- Parallelize within a day: `Promise.allSettled` over the batch of place-detail lookups + directions computations.
- Run days sequentially to bound peak Google-API fan-out on large plans.
- Error handling: on `NoRouteError` or upstream error for a single travel, record `{ travelId, reason }` in a `routeFailures` array and leave the row's `travelTime` / `routePath` untouched. One travel failing doesn't abort the batch. The engine converts each entry into a `cascade_unresolved` alert on the travel.

### Engine orchestrator

```
plan     = loadPlanForEditor(planId)               // uncached read
for each day in plan.days (sequential):
  resolved = { day, events, travels, places } filtered to the day
  { routeFailures } = backfillDay(resolved)        // writes to DB
refreshed = loadPlanForEditor(planId)              // re-read to see backfill
for each day in refreshed.days:
  { events, alerts } = cascade(resolved)
  persist updates (guarded: skip fields in lockedFields; description default does NOT lock)
final = loadPlanForEditor(planId)
alerts = dedupeAlerts([routeFailureAlerts, cascadeAlerts, validate(final)])
return { alerts }
```

Caller (0012's Server Action) calls `updateTag('plan:${planId}')` after the engine returns.

### Idempotence

Auto Fill can re-run safely. A second run after no edits should produce no writes (all fields already set; empty descriptions stay defaulted; no new Alerts).

### Cost control

- Places cache TTL (30d on hours) cuts most details calls to zero after the first run.
- Directions cache indefinite — second run on the same (origin, dest, vehicle) is zero-cost.
- Never fan out to Directions when `vehicle` is null; that's an Issue emitted by `validate`.

## Verification

This sub-plan has no UI; verification is by direct invocation in a scratch script run via `pnpm dlx tsx scripts/autofill-smoke.ts`. Delete the script after confirming.

The script exercises `cascade()` directly (no DB, no Google). Fixtures cover:

1. **Canonical demo** — E1 (start 09:00, dur 30), E2 blank, E3 (start 17:00); travels E1→E2=15, E2→E3=30. Expected: E2 startTime=09:45 (forward), E2 stayDuration=405 (combined `backward.end − forward.start` = 16:30 − 09:45). No alerts.
2. **Insufficient anchors** — E1 (start 09:00, dur 30), E2 blank, E3 blank. Forward reaches E2 but stops (no E2 duration). Backward has no seed. Cascade emits no updates past E1; no alerts from cascade (event-missing-start alerts remain a gap — see Merge notes).
3. **Conflict** — E1 (start 09:00, dur 30), E2 (dur 60), E3 (start 12:00); travel times chosen so forward and backward disagree on E2.startTime. Cascade emits `cascade_unresolved` on E2.
4. **Locked field respected** — E2 has `startTime` set and `lockedFields: ["startTime"]`; surrounding anchors would compute a different value. Cascade does not overwrite.
5. **Description defaulting** — Event with empty description + place with `category="Buddhist temple"` → cascade sets description. `lockedFields` unchanged.
6. **User description not overwritten** — Event with `description="my notes"` → cascade leaves it alone.
7. **Idempotence** — Fully-populated day → cascade returns zero updates, zero alerts.
8. **Backward derives duration** — E1 (start 09:00), E2 (start 10:00), travel 15 → cascade sets E1.stayDuration=45.

Integration testing (the engine end-to-end with real DB + Google) lands naturally in `0012`, which wires the engine to a Server Action + UI button.
