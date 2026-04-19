# Travel Planner — Implementation Plan

> Master plan. See `docs/product.md` for the product design this implements, and `docs/0001-foundations.md` … `docs/0016-polish-verification.md` for executable sub-plans.

---

## 1. Context

Build a single-user, human-in-the-loop travel itinerary planner as described in `docs/product.md`. The human provides intent (places, ordering, anchor times); the machine fills derivable data (Google Places metadata, travel time via Directions, cascaded clock times), validates (hours, conflicts, gaps), renders on an always-on map alongside an editable Table or Timeline, and exports a polished PDF. Released plans live at unlisted URLs and are mobile-first.

Scaffold: Next.js 16.2.4 + React 19 + Tailwind 4 + TypeScript strict at ``. No domain code yet.

**Important:** This is NOT the Next.js you know from training data. Before writing any code, consult `node_modules/next/dist/docs/` for the version-matched API. The v16 specifics that shape this implementation:
- **Cache Components** enabled (`cacheComponents: true`) — reads use `'use cache'` + `cacheTag`; mutations invalidate with `updateTag`.
- **Async request APIs** — `params`, `searchParams`, `cookies()`, `headers()` are Promises.
- **Proxy** has replaced "middleware" (rename only; we don't use it — no auth).
- **Turbopack** is the default bundler.
- **`unstable_instant`** validates instant client navigations; export from pages we want to stay static-shell.

---

## 2. Decisions

| Area | Choice | Why |
|---|---|---|
| Persistence | **Postgres** via `DATABASE_URL` | Portable; supports unlisted-URL feature; works local or hosted (Neon/Supabase/local). |
| ORM | **Drizzle** + `drizzle-kit` | TypeScript-first, no codegen round-trip, readable SQL. |
| Auth | **None** | Spec lists multi-user as non-goal; host is trusted. |
| UI | **shadcn/ui** (Base UI + Tailwind 4 + CVA + lucide-react) | Own-your-code primitives for a dense editor surface. Default `style: 'base-nova'`, `baseColor: 'neutral'`, OKLCH tokens. |
| Interactive map | **`@vis.gl/react-google-maps`** | Modern, maintained Google React wrapper. |
| Static map (PDF) | **Google Static Maps API** | Single image; self-contained PDF. |
| PDF | **`@react-pdf/renderer`** | Server-side React → PDF via stream. |
| Time | **`date-fns`** + **`date-fns-tz`** | Tree-shakeable; single zone per plan. |
| Client state | **Zustand** (selection, day focus) | Minimal; integrates with server-action flow. |
| Validation | **Zod** at server-action boundaries | Shared types via `z.infer`. |
| Slugs | **`nanoid`** (16 char url-safe) | Hard-to-guess; ~95 bits entropy. |
| Tests | **None in v1** | Manual verification; pure functions shaped for future unit tests. |
| Mutations | **Server Actions** + `updateTag('plan:${planId}')` | Field edits: local state + debounced action; row ops: `useOptimistic`. |

**Product §8 open-question resolutions**:
1. Hours overrides are **per-Plan** (key: `(plan_id, place_id)`).
2. Lodging is a **Place reference only** — no check-in/check-out times in v1.
3. **Implicit lock**: any user-typed value is locked. Persisted as `locked_fields` JSONB array on Event/Travel.
4. PDF compact variant **deferred**.
5. Released page shows **all alerts** (Issues + Warnings).

---

## 3. Target architecture

### Directory layout

```
src/
  app/
    layout.tsx                       # theme + font wrapper (rewritten from scaffold)
    page.tsx                         # plans list (rewritten)
    globals.css                      # tailwind + theme tokens
    plans/
      new/page.tsx                   # create plan dialog host
      [planId]/
        edit/page.tsx                # split-pane editor (server wrapper)
        settings/page.tsx            # rename, tz, duplicate, delete
        pdf/route.ts                 # streaming PDF route handler
    p/[slug]/page.tsx                # released, mobile-first, read-only
    api/
      places/
        autocomplete/route.ts
        details/route.ts
        photo/[placeId]/[idx]/route.ts
      directions/route.ts
  components/
    ui/                              # shadcn primitives (button, dialog, popover, …)
    editor/                          # SplitPane, DayTabs, TableView, TimelineView, Toolbar
    map/                             # MapPane, Pin, Polyline, DaySelector
    places/                          # PlacePicker, PlacePreview, HoursEditor
    alerts/                          # AlertPanel, InlineMarker
    pdf/                             # Cover, Overview, PerDay, DetailCard (react-pdf)
  db/
    index.ts                         # drizzle client
    schema.ts                        # tables (see §4)
    migrations/                      # drizzle-kit output
  lib/
    time.ts                          # 15-min rounding, TZ helpers, HH:MM ↔ HH:MM:SS bridge
    cascade.ts                       # pure forward/backward/merge reducer
    validate.ts                      # pure alert rules
    google/
      places.ts                      # server-side HTTP calls
      directions.ts
      staticMap.ts                   # URL builder
      types.ts                       # response shapes (AutocompleteHit, PlaceDetails, DirectionsResult)
      invalidate.ts                  # admin cache-invalidation helpers
    slug.ts                          # nanoid wrapper (16-char URL-safe)
    schemas.ts                       # shared Zod schemas + PlaceHours / Vehicle / Alert types
    actions.ts                       # Result<T>, ActionError, ok/err/zodErr — server-action return convention
    utils.ts                         # shadcn cn() (clsx + tailwind-merge)
    model/
      plan.ts                        # read-side composition (plan + days + events + travels resolved)
      plans.ts                       # plans-index and single-plan reads (listPlans, getPlan)
  stores/
    selection.ts                     # zustand store: { selectedId, hoveredId, currentDayId }
  actions/                           # 'use server' mutation actions grouped by entity
    plans.ts                         # createPlan, renamePlan, setPlanTimezone, duplicatePlan, deletePlan
next.config.ts                       # cacheComponents, serverExternalPackages, image remotePatterns
drizzle.config.ts
```

### Data flow

- **Reads** — Server Components call helpers in `lib/model/plan.ts`, wrapped in `'use cache'` with `cacheTag('plan:${planId}')` (and finer tags like `plan:${planId}:day:${dayId}` where useful). All cache-relevant inputs are passed as arguments (never read from closure) so Cache Components can key correctly. No `cookies()`/`headers()` inside cached functions (we have no auth).
- **Mutations** — Server Actions in `src/actions/` mutate via Drizzle, call `updateTag('plan:${planId}')`, and either return a result or rely on the router to revalidate. Field-level edits use local controlled state + debounced action; row-level add/remove/reorder uses `useOptimistic` for snap.
- **Google APIs** — Route handlers in `app/api/` (not actions, so they can use `revalidateTag('places', 'max')` when cache refresh is required). Responses persist in `places_cache` and `directions_cache` Drizzle tables. Photos are downloaded once to `public/places/{placeId}/{idx}.jpg`; subsequent reads are pure static.
- **Interactive UI state** — Zustand holds `{ selectedId, hoveredId, currentDayId }`. Both Map and right pane subscribe; selection persists across Table↔Timeline toggles. No server round-trip for selection.

### Next 16 specifics we honor

- `cacheComponents: true` in `next.config.ts`. Default runtime is Node (required by `@react-pdf/renderer` and `pg`).
- `params`/`searchParams` awaited in every dynamic route. **Under Cache Components, awaiting `params` at the top of a page component counts as "uncached data access" and fails the prerender unless wrapped in `<Suspense>`.** The project convention (established in `0003`'s settings page): the exported page component is synchronous, returns `<Suspense fallback={<Skeleton />}><Content paramsPromise={params} /></Suspense>`, and a nested async component does the `await params` + cached read. Apply this pattern to every dynamic page (`0004` editor, `0013` released view). Route handlers are unaffected — they run server-side and return a `Response`.
- Map subtree is a `'use client'` leaf inside a server-rendered split-pane; server passes serialized plan-for-current-day as props.
- `@react-pdf/renderer` added to `serverExternalPackages`.
- `unstable_instant = { prefetch: 'static' }` exported from `/` and `/plans/[planId]/edit` after the full data shape settles (audited in `0016`).
- `useOptimistic` **only** for row-level adds/removes/reorders — never per-field edits (which would require a full reducer across 6+ column mutation shapes).

---

## 4. Schema summary

Drizzle tables (details in `0001-foundations.md`):

| Table | Role |
|---|---|
| `plans` | id, name, timezone, released_slug (nullable), created_at, updated_at |
| `days` | id, plan_id, date, start_lodging_place_id, end_lodging_place_id, position |
| `events` | id, day_id, position, place_id, start_time, stay_duration, description, remark, locked_fields (jsonb), updated_at |
| `travels` | id, day_id, position (between events), vehicle, travel_time, route_path (jsonb), locked_fields (jsonb), updated_at |
| `places` | google_place_id (pk), name, address, lat, lng, photos (jsonb), hours (jsonb), category, fetched_at |
| `plan_place_overrides` | (plan_id, place_id) composite pk, hours (jsonb) — per-Plan overrides |
| `places_cache` | google_place_id, raw_response, fetched_at — for TTL refresh logic |
| `directions_cache` | (origin_place_id, dest_place_id, vehicle) composite pk, travel_time, route_path, fetched_at |

Notes:
- Times are stored as `time` (HH:MM) columns in the plan's timezone. Dates stored as `date`.
- `travel_time` stored as an integer minute count.
- `position` on `days` / `events` / `travels` is a sparse integer; reorder updates position only.
- `locked_fields` is a JSONB array of strings naming fields the user has set (e.g. `["start_time", "stay_duration"]`), read by the cascade reducer to avoid overwriting.

---

## 5. Milestone sequence

| # | File | Scope (summary) | Depends on |
|---|---|---|---|
| 1 | `0001-foundations.md` | Postgres + Drizzle, schemas, migrations, `next.config.ts` (Cache Components + `serverExternalPackages`), shadcn init, base layout/theme/error/not-found, `lib/time.ts`, shared Zod schemas. | — |
| 2 | `0002-google-proxy.md` | Route handlers for Places (autocomplete, details, photo→disk) + Directions, `places_cache` / `directions_cache` TTL strategy. | 0001 |
| 3 | `0003-plan-crud.md` | `/` plans list, create/rename/duplicate/delete actions, settings route (timezone edit), derived status from `released_slug`. | 0001 |
| 4 | `0004-editor-shell.md` | `/plans/[planId]/edit` split-pane skeleton, Day tabs + Add Day (date validation: no duplicates), Lodging slot per day, inherit-previous default. | 0003 |
| 5 | `0005-places-picker.md` | `PlacePicker` (typeahead → preview), hours override UI per-Plan, TZ inference from first Place, photo pipeline to `public/places/…`. | 0002, 0004 |
| 6 | `0006-events-table.md` | Table view with interleaved Event/Travel rows, add/remove/reorder (`useOptimistic`), vehicle picker, inline edits (local state + debounced action + `updateTag`), 15-min rounding, `updated_at` concurrent-edit refresh. | 0005 |
| 7 | `0007-map-render.md` | Interactive map pane rendering current Day: numbered Event pins, distinct Lodging pin, per-vehicle polyline colors. Pure render from props. | 0006 |
| 8 | `0008-timeline-view.md` | Vertical hours axis, Event blocks positioned by start + stay duration, Travel connectors, empty-space gaps, Table↔Timeline toggle. | 0006 |
| 9 | `0009-map-sync.md` | Two-way click/hover sync Map ↔ right pane via Zustand; selection persists across view toggle; Day selector on Map. | 0007, 0008 |
| 10 | `0010-validation-alerts.md` | Pure `validate(plan)` → `Alert[]`; all Issue + Warning rules; AlertPanel + inline markers; day-date-overlap rule. Defines Alert shape for Auto Fill. | 0006 |
| 11 | `0011-autofill-engine.md` | (a) Backfill: Places metadata + Directions (round-up to next 15 min). (b) Cascade reducer: pure forward + backward + merge, respects `locked_fields`, fills empty descriptions from Google data. Returns `{ updates, alerts }`. | 0002, 0010 |
| 12 | `0012-autofill-action.md` | Server action orchestrates 0011 and persists results; "Auto Fill" button in editor header; dirty-state indicator after any edit. | 0011 |
| 13 | `0013-release-sharing.md` | Release/Unrelease actions; `/p/[slug]` mobile-first read-only route; live state from DB; all alerts shown; PDF download link. | 0003, 0010 |
| 14 | `0014-pdf-tree.md` | React-PDF component tree with fixtures: Cover, Overview, PerDay (Timeline + StaticMap + DetailCards), Footer with alert summary. Runnable from a local script for iteration. | 0005 |
| 15 | `0015-pdf-route.md` | `/plans/[planId]/pdf/route.ts` streaming handler; Static Maps URL builder; font registration; `serverExternalPackages`. Hooked from editor + released page. | 0014, 0013 |
| 16 | `0016-polish-verification.md` | `unstable_instant` audit; error boundaries; loading states; image optimization; walk-through of product.md §9 scenarios. | all |

**Parallelization**:
- After 0001 + 0002: **0003 and 0005** can proceed in parallel.
- After 0006: **0007 and 0008** in parallel.
- **0014** (react-pdf tree with fixtures) can start any time after 0005.

---

## 6. Cross-cutting conventions

### Server Action shape

```ts
'use server'
import { updateTag } from 'next/cache';
import { err, ok, type Result, zodErr } from '@/lib/actions';

export async function updateEvent(input: UpdateEventInput): Promise<Result<void>> {
  const parsed = UpdateEventSchema.safeParse(input);       // zod boundary
  if (!parsed.success) return err(zodErr(parsed.error));
  await db.update(events).set(parsed.data.patch).where(eq(events.id, parsed.data.id));
  updateTag(`plan:${parsed.data.planId}`);
  return ok();
}
```

- Every action: `safeParse` at top (never `.parse()` — that throws), DB mutate, `updateTag`, return `Result`.
- Never throw for business errors — return a `Result` the caller can render. The `Result<T, E>` / `ActionError` / `ok` / `err` / `zodErr` helpers live in `src/lib/actions.ts` (established in `0003`).
- Import `cacheTag` / `updateTag` from `next/cache` directly; the `unstable_*` aliases are historical.
- Grouped by entity in `src/actions/{plans,days,events,travels,places,alerts,release}.ts`.

### Cache tag namespacing

- `plan:${planId}` — any read touching a plan's composition.
- `plan:${planId}:day:${dayId}` — optional finer tag when a component reads only one day.
- `places` — global tag for the Places cache (refreshed via scheduled or manual admin, not per-user).
- `directions` — same.

Always call `updateTag(`plan:${planId}`)` on any plan-scoped mutation. No global `'plans'` tag.

### Error handling

- Server components: narrow errors at the query layer; return `null` for "not found"; show a `<NotFound />` component. Use `error.tsx` per route for uncaught exceptions.
- Client components: surface action errors via a toast (shadcn `Sonner` or custom).
- Route handlers: return JSON `{ error: string }` + proper status codes.

### "Locked field" representation

- `locked_fields: string[]` on `events` and `travels` (JSONB).
- A field is added to `locked_fields` whenever the user explicitly sets it via any UI (including clearing — storing `null` + lock is valid).
- The cascade reducer (`lib/cascade.ts`) skips any field whose name is in `locked_fields` of the target row.
- There is **no** lock UI affordance — the lock is implicit (per product §8 resolution).

### Time & timezone

- All stored times are in the Plan's current timezone. If the user changes timezone, we **convert** stored times to the new zone at write time (see `0003-plan-crud.md` for the exact routine).
- Display is always in the Plan's zone.
- All user-input times round to 15-min on entry. All Directions travel times round **up** to next 15-min before write.

---

## 7. Verification

The product's §9 scenarios map to sub-plans that prove each slice:

| Scenario | Proven by |
|---|---|
| Happy path (3-day Tokyo plan, Auto Fill, Release, PDF) | `0012`, `0013`, `0015`, end-to-end walk in `0016` |
| Conflict path (restaurant after closing) | `0010` (rule fires) + `0013` (shows on released) |
| Partial path (cascade gap Issue) | `0011` (cascade + merge) + `0010` (alert rendering) |
| Edit-after-release | `0013` (`/p/[slug]` reads live DB) + `0006` (edit propagates via `updateTag`) |
| Gap path (30 min OK, 90 min Warning) | `0010` (gap rule) + `0008` (timeline blank space) |
| Map interaction (click sync) | `0009` |
| Released mobile path | `0013` (mobile-first layout) + `0016` (manual test on phone) |

Each sub-plan has its own Verification section with concrete dev-server steps.

---

## 8. Open risks / deferred

- **Google API cost** — Auto Fill fans out to N Places + N Travels per invocation. Mitigated by `places_cache` (long TTL for coords/name; 30d TTL for hours) and `directions_cache` (indefinite; routes rarely change). Still worth budgeting before heavy use.
- **Released-URL security** — `nanoid` 16-char slug ≈ 95 bits. Practically unguessable; not a secret. Meets the spec's "unlisted" bar.
- **Photo licensing** — Places Photo API TOS restricts redistribution. We store locally per-plan; PDFs embed photos. Fine for personal use; confirm TOS before public hosting.
- **Timezone change mid-plan** — On TZ edit we convert stored times (see 0003). The cost is one SQL update per Day's rows; acceptable.
- **Concurrent two-tab editing** — Last-write-wins via `updated_at` + router `refresh()` reconciliation after each action. No OT/CRDT (out of v1 scope).
- **No tests in v1** — Pure functions (`lib/cascade.ts`, `lib/validate.ts`, `lib/time.ts`) are structured for drop-in Vitest later.
- **PDF compact variant** — Deferred (product §8 Q4).

---

## 9. Reading order for implementers

Start with `0001-foundations.md`, then follow the Depends-on graph in §5. Don't skip sub-plans that only add types or utilities — downstream sub-plans assume them. Before coding anything that touches Next.js itself, read the relevant guide in `node_modules/next/dist/docs/`.
