# 0011 — Auto Fill engine (backfill + cascade)

## Context

Auto Fill is the machine's moment to earn its keep. Given a plan where the human has specified *what* (places, ordering, anchor times, vehicles), it fills *derivable* fields: missing Place metadata, travel times and routes per Travel, cascaded start/end times, and default descriptions. It respects user locks (`locked_fields`) and emits Alerts when the cascade fails. Product §5.6.

This sub-plan delivers the pure engine; `0012` wires it to a server action and UI button.

## Prerequisites

- `0002` (Places / Directions proxy + caches).
- `0010` (Alert shape).

## Scope

**In:**
- `src/lib/cascade.ts` — pure reducer. Given a `ResolvedDay`, returns `{ events: EventUpdates[], travels: TravelUpdates[], alerts: Alert[] }`. No I/O.
  - Forward cascade
  - Backward cascade
  - Merge with conflict detection
  - Respects `locked_fields`
  - Description defaulting (empty description → Place's primary category / display text; marks as NOT locked)
- `src/lib/autofill/backfill.ts` — I/O-bound helper. For a `Day`:
  1. For each Event/Travel referencing a Place that's missing from `places`, call `/api/places/details` (internal fetch).
  2. For each Travel that has a vehicle and lacks `travelTime` / `routePath`, call `/api/directions` with origin = prev event/lodging place id, dest = next event/lodging place id.
  3. Write results to DB.
  4. Return the freshly-resolved Day.
- `src/lib/autofill/engine.ts` — orchestrator: `runAutoFillForPlan(planId) → { alerts }`. For each Day, calls backfill then cascade; persists cascade updates; collects alerts (cascade + `validate`).

**Out:**
- Server action wiring + UI button (`0012`).
- Dirty-state indicator UX (`0012`).

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
- `/Users/xuhan/code/travel-tw/src/lib/cascade.ts`
- `/Users/xuhan/code/travel-tw/src/lib/autofill/backfill.ts`
- `/Users/xuhan/code/travel-tw/src/lib/autofill/engine.ts`
- `/Users/xuhan/code/travel-tw/src/lib/autofill/types.ts`

Modify: none in this sub-plan (wiring happens in `0012`).

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

If a field is in `locked_fields`, skip setting it (but keep walking).

### Backward cascade

Symmetric: start from latest time-anchored event, walk up filling missing `endTime`, `stayDuration`, previous Travel durations.

### Merge

Walk the Day once more. For each field:
- If forward set it and backward didn't → keep forward.
- If backward set it and forward didn't → keep backward.
- If both set it and values agree → keep.
- If both set it and values disagree → emit `cascade_unresolved` with a message naming the conflict; leave field blank.
- If neither set it AND the field was required (e.g. Event.startTime) → emit `cascade_unresolved`.

### Description defaulting

For each Event with empty `description` and a resolved Place:
- Candidate: `category` (e.g. "Buddhist temple") or `name`'s type hint from Google's response.
- Set `description` to the candidate.
- Do NOT add to `locked_fields` — user-typed is what locks.

### Backfill details

- Self-fetch `/api/places/details` and `/api/directions` from server code. These route handlers already handle caching, so repeated calls within one Auto Fill run are cheap.
- Parallelize: `Promise.all` per-Day for the independent requests (place details + directions in one batch).
- Error handling: if a directions call fails (e.g. no route), set `travelTime` to null but emit an Issue via the caller; don't throw.

### Engine orchestrator

```
for each day:
  backfill(day)    // mutates DB
  resolved = refetchDay(day.id)
  { events, travels, alerts } = cascade(resolved)
  persist updates (guarded: skip fields in locked_fields)
updateTag(`plan:${planId}`)
return combined alerts (cascade + fresh `validate(resolvedPlan)` pass)
```

### Idempotence

Auto Fill can re-run safely. A second run after no edits should produce no writes (all fields already set; empty descriptions stay defaulted; no new Alerts).

### Cost control

- Places cache TTL (30d on hours) cuts most details calls to zero after the first run.
- Directions cache indefinite — second run on the same (origin, dest, vehicle) is zero-cost.
- Never fan out to Directions when `vehicle` is null; that's an Issue emitted by `validate`.

## Verification

This sub-plan has no UI; verification is by direct invocation in a scratch script:

1. Write `scripts/autofill-smoke.ts` that calls `runAutoFillForPlan('<someId>')` on a test plan populated via the editor. Confirm:
   - `travels` rows get `travelTime` and `routePath`.
   - `events` without user-set start/duration get filled via cascade.
   - Locked fields are not overwritten (populate a plan with a start_time on the user side, add it to `locked_fields`, run engine, confirm unchanged).
2. Unit-by-inspection: build a synthetic `ResolvedDay` with 3 events (E1 start 09:00 30min, E2 no time, E3 start 17:00) and travels with `travelTime` set (E1→E2 15m, E2→E3 30m). Call `cascade(day)` — expect E2.startTime=09:45, but E2.stayDuration can't be derived (E3 start 17:00 - E2→E3 travel 30m = 16:30 means E2.endTime=16:30, so duration=16:30-09:45=6:45; that's computable actually — make sure both cascades agree). Tune the fixture until the cascade demo is clean.
3. Corner case: E1 start 09:00, E2 and E3 no times → forward can't reach E3 end, backward can't start → cascade emits `cascade_unresolved` for E2 and E3.
4. Delete `scripts/autofill-smoke.ts` after confirming.
