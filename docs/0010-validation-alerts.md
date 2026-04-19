# 0010 — Validation rules & Alerts UI

## Context

Alerts are first-class: they render in a side panel, on inline markers, on the released page, and in the PDF. Product §5.7 defines every rule and its severity. Validation is a pure function over a resolved plan — it runs on every read, not only after Auto Fill. Establishing the Alert shape here unblocks `0011` (Auto Fill uses the same Alert type for cascade errors).

Product §5.7, §8 Q5 (resolved: show all alerts on released page), §9 scenarios 2, 3, 5.

## Prerequisites

- `0001` (Alert Zod schema stub).
- `0006` (Table rows exist and need inline markers).
- `0008` (Timeline blocks need inline markers).

## Scope

**In:**
- `src/lib/validate.ts` — pure `validate(plan: ResolvedPlan): Alert[]`. Inputs are the fully resolved plan (plan + days + events + travels + places + overrides). No network, no DB.
- Rules, matching §5.7:
  - **Issues**:
    1. Day has no start Lodging → `day_missing_lodging`
    2. Day has no end Lodging → `day_missing_end_lodging`
    3. Event has no Place → `event_missing_place`
    4. Travel has no vehicle → `travel_missing_vehicle`
    5. Event arrives outside Place's effective hours → `event_outside_hours`
    6. Event departs (end_time) outside closing hours when applicable → `event_closes_during`
    7. Overlapping Events (next.start < prev.end + travel) → `events_overlap`
    8. Cascade cannot compute (forward + backward don't meet) → `cascade_unresolved` (emitted by `0011`; rule validated here too for independent runs)
    9. Duplicate day date → `day_duplicate_date`
  - **Warnings**:
    1. Tight connection: travel buffer < 5 min after rounding → `travel_tight`
    2. Long gap: arrival → next start > 60 min → `gap_long`
    3. Travel time exceeds vehicle threshold (walk 45m, cycle 60m, drive 90m, transit 120m) → `travel_long`
    4. No business hours data on Place → `place_hours_unknown`
- `AlertPanel` component in the editor's right rail (collapsible). Shows alerts for the current Day grouped by severity, each with a click-to-focus that calls `select(entityId)`.
- Inline markers on Event / Travel / Day headers (Table + Timeline): red dot (Issue) / yellow dot (Warning); tooltip with the first message; badge with count if >1.
- Alerts are also computed per-Plan (not just per-Day) so the Plan-level header shows a consolidated count.

**Out:**
- Released-page alert rendering (`0013`).
- PDF alert summary (`0014`).
- Auto Fill's own alerts (emitted in `0011`, but use the same Alert shape).

## Schema / types

No new tables (alerts are always derived, never persisted).

Final Alert shape (`src/lib/schemas.ts`):
```ts
export const AlertSchema = z.object({
  severity: z.enum(['issue', 'warning']),
  code: z.enum([
    'day_missing_lodging', 'day_missing_end_lodging', 'day_duplicate_date',
    'event_missing_place', 'event_outside_hours', 'event_closes_during',
    'travel_missing_vehicle', 'travel_tight', 'travel_long',
    'events_overlap', 'cascade_unresolved', 'gap_long', 'place_hours_unknown',
  ]),
  entity: z.object({
    type: z.enum(['plan','day','event','travel']),
    id: z.string(),
  }),
  message: z.string(),
  hint: z.string().optional(),
});
export type Alert = z.infer<typeof AlertSchema>;
```

## Files

Create:
- `src/lib/validate.ts` — pure rules.
- `src/lib/validate.test.ts` — leave empty; noted here so future unit tests have a natural home.
- `src/components/alerts/AlertPanel.tsx`
- `src/components/alerts/InlineMarker.tsx`
- `src/lib/model/alerts.ts` — `getAlertsForPlan(planId)`: cached; rebuilds on `updateTag('plan:${planId}')`.

Modify:
- `src/components/editor/EventRow.tsx` — render `InlineMarker` in the Alert cell.
- `src/components/editor/TravelRow.tsx` — same.
- `src/components/editor/EditorShell.tsx` — mount `AlertPanel` as a collapsible drawer.
- `src/components/editor/timeline/EventBlock.tsx` — inline marker.

## Implementation notes

- **Pure function, no side effects** — `validate` takes a fully hydrated plan object; every rule is a separate function returning `Alert[]` given the same input; the top-level `validate` concatenates. Easy to debug, easy to test, trivially cacheable.
- **Rule dependencies** — `events_overlap` depends on travel times being resolved; if not, emit `cascade_unresolved` instead (the overlap rule returns []).
- **Hours check** — merge `plan_place_overrides.hours` over `places.hours`; if both are missing, emit `place_hours_unknown` (Warning) instead of `event_outside_hours`.
- **Rounding** — the "tight connection" rule sees rounded travel times; buffer < 5 min means remainder after last event's end + travel vs next event's start is < 5 min. If exactly 0 but values align, it's still a tight warning; if negative, that's an overlap Issue.
- **Ordering/duplicates** — de-duplicate alerts that might fire twice (e.g., same overlap registering from two adjacent rows); keep one, on the earlier entity.
- **Message tone** — short, declarative. "Tsukiji Outer Market closes at 14:00; arrival 14:30." Include numbers.
- **`AlertPanel`** — collapsible drawer pinned to the right edge of the right pane. Header toggle button shows total count with severity colors. Clicking an alert entry calls `select(alert.entity.id)` so map + pane react.
- **Re-validation cost** — `validate` is O(events + travels) per plan, microseconds; rerun on every render via the cached model layer.

## Verification

1. Create a Day with no Lodging → Issue "Day has no Lodging" shows in panel and on the Day header; editor header shows "1 Issue".
2. Add an Event with no Place → Issue "Event missing Place" on that row; inline red dot.
3. Pick a Place, set start 14:30 at a venue that closes 14:00 → Issue "Tsukiji Outer Market closes at 14:00; arrival 14:30".
4. Set Events with overlapping times → Issue "Events overlap" on the second one.
5. Pick a restaurant with no Google hours → Warning "Hours not available for X".
6. Set a walking travel of 60 min → Warning "Travel time 60 min exceeds threshold 45 min for walk".
7. Pick duplicate date across two days → Issue "Duplicate day date" on both days.
8. Click alert row in panel → map pans to entity; right-pane scrolls and highlights.
9. Toggle Table → Timeline → inline markers appear consistently in both views.
