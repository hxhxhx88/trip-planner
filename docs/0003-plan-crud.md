# 0003 — Plan list & CRUD

## Context

Users manage multiple trips. The landing page lists plans with their status, and supports create / rename / duplicate / delete. A plan settings page holds name, timezone (editable; changes rebase stored times), and destructive actions. Product §5.1 (plan management) and §6 (time zone on plan).

## Prerequisites

- `0001-foundations.md` (schema, layout, time helpers, Zod schemas).

## Scope

**In:**
- `/` — plans list. Table with columns: Name, Dates, Status (Draft / Released), Last edited, Actions (Edit / Rename / Duplicate / Delete).
- "New plan" dialog: name + timezone (default to `Intl.DateTimeFormat().resolvedOptions().timeZone` client-side; user can pick).
- Server actions in `src/actions/plans.ts`: `createPlan`, `renamePlan`, `duplicatePlan`, `deletePlan`, `setPlanTimezone`.
- `/plans/[planId]/settings` — form for rename, timezone, plus duplicate/delete buttons.
- Status derivation: `status = releasedSlug ? 'Released' : 'Draft'`. (Auto-filled is a transient UI state tracked client-side, not persisted.)
- TZ change behavior: converts stored HH:MM times (on events, travels) from old TZ to new TZ on the same date. Implemented via a helper in `lib/time.ts` (`rebaseTimesAcrossTz`).
- `duplicatePlan`: copies plan + all days + events + travels + per-plan overrides. New plan is Draft (no `releasedSlug`). New ids everywhere.

**Out:**
- Editor itself (`0004`).
- Released page (`0013`).
- PDF link (`0015`).

## Schema / types

No new tables. Uses existing.

Input Zod schemas (in `src/actions/plans.ts`):
- `CreatePlanInput = { name: string.min(1).max(120), timezone: string (IANA zone) }`
- `RenamePlanInput = { id: string, name: string.min(1).max(120) }`
- `DuplicatePlanInput = { id: string }`
- `DeletePlanInput = { id: string }`
- `SetTimezoneInput = { id: string, timezone: string }`

## Files

Create:
- `/Users/xuhan/code/travel-tw/src/actions/plans.ts`
- `/Users/xuhan/code/travel-tw/src/lib/model/plans.ts` — `listPlans()`, `getPlan(id)`, wrapped in `'use cache'` with appropriate tags.
- `/Users/xuhan/code/travel-tw/src/components/plans/PlansList.tsx`
- `/Users/xuhan/code/travel-tw/src/components/plans/NewPlanDialog.tsx`
- `/Users/xuhan/code/travel-tw/src/components/plans/PlanRowActions.tsx`
- `/Users/xuhan/code/travel-tw/src/app/plans/new/page.tsx` — route that just mounts `NewPlanDialog` (separate URL so we can link to it).
- `/Users/xuhan/code/travel-tw/src/app/plans/[planId]/settings/page.tsx`

Modify:
- `/Users/xuhan/code/travel-tw/src/app/page.tsx` — render `PlansList`.

## Implementation notes

- **Reads** — `listPlans()` in `lib/model/plans.ts`:
  ```ts
  'use cache';
  cacheTag('plans:index');
  // returns [{ id, name, timezone, releasedSlug, createdAt, updatedAt, firstDate, lastDate, dayCount }]
  ```
  Join against `days` aggregates. `getPlan(id)` tagged with `plan:${id}`. Invalidated via `updateTag('plans:index')` or `updateTag(\`plan:\${id}\`)` on mutation.
- **createPlan** — generate nanoid id, insert plan, `updateTag('plans:index')`, return new id. Creates **no** initial days (the editor's "Add Day" is the entry point).
- **renamePlan** / **setPlanTimezone** — straight update; on TZ change, run `rebaseTimesAcrossTz` in the same DB transaction.
- **rebaseTimesAcrossTz** — for each event with a `startTime`, combine with day's `date` in the old TZ → `Date` → format in new TZ → new `startTime`. Same for travel `travelTime` (this is duration; unchanged). `routePath` unchanged. Pure function over rows; batch update.
- **duplicatePlan** — open a transaction; read source plan graph; insert new plan with suffix " (copy)" and no `releasedSlug`; insert all days with new ids but same positions/dates; re-map event/travel `dayId`s; copy `plan_place_overrides` with new `planId`. `places`/`places_cache`/`directions_cache` untouched (shared reference by place id).
- **deletePlan** — cascade delete via FK. Also remove downloaded photos for places referenced *only* by this plan? Not worth it in v1 — photos are cheap, shared, and the overrides cascade.
- **Dialog vs route** — `NewPlanDialog` can be opened from the list (client dialog) OR deep-linked at `/plans/new` (server wrapper that renders the same dialog with `open={true}`). Use `router.push('/plans/[planId]/edit')` on success.
- **Settings page** — form with three sections: General (name, timezone), Duplicate, Danger zone (delete with confirm). Separate action per section for clearer server-action responses.
- **Status badge** — small shadcn `Badge` variant; Draft (neutral) / Released (green).
- **Sort** — plans list sorted by `updatedAt desc` by default.

## Verification

1. `pnpm dev`; hit `/` → empty-state card with "Create your first plan" CTA.
2. Click New Plan → dialog opens, fill in "Tokyo Trip", tz auto-filled to local → Create. Redirects to `/plans/[id]/edit` (404 for now until `0004`). Row appears in `/` list.
3. From row menu: Rename → in-place rename; reload → persists.
4. From row menu: Duplicate → new row appears "Tokyo Trip (copy)"; `releasedSlug` null; settings page confirms.
5. `/plans/[id]/settings` → change timezone to "America/New_York"; event startTime values (once any exist, see `0006`) rebase correctly; revisit Table shows shifted times.
6. Delete plan with confirm → row disappears; direct URL to settings 404s via `not-found.tsx`.
7. Cache: after rename, the `/` list updates without a full refresh — verifies `updateTag('plans:index')`.
