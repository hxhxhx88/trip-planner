# 0013 — Release & shared mobile view

## Context

Releasing a Plan mints an unlisted URL (hard-to-guess slug) at which the Plan can be viewed read-only from any device. The shared page is **mobile-first**, separate from the planner's split-pane. Editing a released Plan is allowed and edits propagate live to the URL; Unreleasing retracts the URL (visits → 404). Product §§5.9 (release & sharing), 3 (state machine), §8 Q5 (resolved: show all alerts).

## Prerequisites

- `0003` (plan CRUD + `releasedSlug` column).
- `0006` (events), `0010` (alerts) — released page renders these.

## Scope

**In:**
- Server actions `releasePlan(planId)` and `unreleasePlan(planId)` in `src/actions/release.ts`.
- `ReleaseBanner` in the editor top bar:
  - When released: shows slug, copy-URL button, "Unrelease" button.
  - When not released: shows "Release" button.
- `/p/[slug]/page.tsx` — public, mobile-first, read-only route. Live-reads the plan by slug; no snapshot.
- Mobile layout:
  - Header: trip name, date range, tz. (The "Download PDF" button lands with `0015` — see §Out.)
  - Per-Day sections, vertically stacked, scrollable. Each section has: Day title, Lodging card (start + end if distinct), Event cards in order, Travel connectors between them.
  - An Event card shows: time range, Place name, photo (first local photo), short description, remark, and an inline alert dot (red for issues, amber for warnings). No tooltip — the full message lives in the Day's Heads-up accordion.
  - A Travel connector shows: vehicle icon, travel time, alert dot (e.g. `travel_missing_vehicle`).
  - Empty time between arrival and the next event's start is visually represented with a small "Free time · 30 min" chip (mirrors Timeline behavior). Rendered only when the gap exceeds 5 min to avoid jitter.
- Alerts on shared page: grouped into a per-Day "Heads-up" native `<details>` accordion at the top of each Day, plus inline dots on each card. Shows both Issues and Warnings (per §8 resolution). No-JS friendly — everything server-rendered.
- 404 for unknown slug (rely on Next 16 `notFound()`).
- Metadata: `<title>` = plan name, `<meta name="robots" content="noindex,nofollow">`, Open Graph with cover image (first Day's first Place photo if available).

**Out:**
- PDF download route (`0015`).
- Planner map rendering on mobile (deliberately out — released view is NOT split-pane).

## Schema / types

No new tables. Uses `plans.releasedSlug` (already exists).

## Files

Create:
- `src/actions/release.ts`
- `src/app/p/[slug]/page.tsx`
- `src/app/p/[slug]/layout.tsx` — mobile-tuned container + `generateMetadata`.
- `src/app/p/[slug]/not-found.tsx` — friendly "This trip is no longer shared" fallback (renders inside the mobile layout container).
- `src/components/released/ReleasedView.tsx` — top-level composition: header (plan name, date range, tz), day-scoped alert map construction, loops days.
- `src/components/released/ReleasedDay.tsx`
- `src/components/released/ReleasedEventCard.tsx`
- `src/components/released/ReleasedTravelConnector.tsx`
- `src/components/released/ReleasedLodgingCard.tsx`
- `src/components/released/ReleasedFreeTime.tsx` — the "Free time · N min" chip (rendered between a Travel and the next Event when the buffer exceeds 5 min).
- `src/components/released/ReleasedAlerts.tsx`
- `src/components/editor/ReleaseBanner.tsx`
- `src/lib/model/released.ts` — exports `getPlanIdBySlug(slug)` (cached with `cacheTag('release:${slug}')`) and `getPlanForReleased(planId)` (a thin wrapper over the already-cached `getPlanForEditor(planId)` which itself carries `cacheTag('plan:${planId}')`). The two-tag composition means any edit to the plan (which calls `updateTag('plan:${planId}')`) invalidates the released view automatically.
- `src/lib/vehicles.ts` — lift `VEHICLE_LABEL` and `VEHICLE_ICON` (previously inline in `VehicleSelect.tsx`) into a shared module so `ReleasedTravelConnector.tsx` can reuse them without duplicating the maps.

Modify:
- `src/app/plans/[planId]/edit/layout.tsx` — replace the disabled `Release` button in the Topbar (server component, alongside `AutoFillButton`) with `<ReleaseBanner planId={planId} releasedSlug={plan?.releasedSlug ?? null} />`. The Topbar already calls `getPlan(planId)` which includes `releasedSlug`.
- `src/components/editor/VehicleSelect.tsx` — import `VEHICLE_LABEL` / `VEHICLE_ICON` from `@/lib/vehicles` (pure refactor; zero behavior change).

## Implementation notes

- **Slug generation** — 16-char `nanoid` with the url-safe alphabet (`lib/slug.ts`). Verify uniqueness before setting (retry on collision); collisions are astronomically rare but keep the guard.
- **`releasePlan`** — idempotent: if already released, returns current slug without minting a new one. Returns `Result<{ slug: string }>`. The absolute URL is composed on the client (`${window.location.origin}/p/${slug}`) to avoid hard-coding a host in the server action.
- **`unreleasePlan`** — clears `releasedSlug`. Invalidates `release:${oldSlug}`, `plan:${planId}`, and `plans:index`. Idempotent when already unreleased.
- **Cache tagging strategy** — two cascaded cached reads: `getPlanIdBySlug(slug)` uses `release:${slug}`, and `getPlanForReleased(planId)` composes with the already-cached `getPlanForEditor(planId)` carrying `plan:${planId}`. Any planner-side edit (which already invalidates `plan:${planId}`) flushes the released view automatically. Unrelease invalidates `release:${slug}` so the slug→id lookup misses and we fall into `notFound()`.
- **Delete-while-released** — `deletePlan` already invalidates `plan:${planId}`. The stale `release:${slug}` entry may still return the old planId on the next request, but `getPlanForReleased(planId)` then misses and returns null (plan row deleted), triggering `notFound()`. No change to `deletePlan` is required.
- **Mobile-first** — Tailwind: `w-full max-w-md mx-auto` container; cards use full width on small screens. Use `text-base/6` body and larger tap targets. No hover-dependent UI.
- **Photo display** — `next/image` served from `/places/{placeId}/0.jpg`. Lazy-load below the fold.
- **Open Graph** — pick a good cover photo (first Day's first placed Event). Fallback to plain color card with trip name.
- **Live edits** — the released page always queries the live plan; edits in the editor appear on next reload. Test: edit a Place description in the editor; refresh `/p/{slug}` on a phone; change visible.
- **`notFound()`** — if `getPlanIdBySlug` returns null, call `notFound()` (Next 16 async-aware). Renders `not-found.tsx` or a local `p/[slug]/not-found.tsx` for a friendlier message.
- **Suspense-async-params pattern** — `/p/[slug]/page.tsx` is a dynamic route under Cache Components. Follow the same shape established by `0003`'s settings page and `0004`'s editor page: a synchronous default export that returns `<Suspense fallback={…}><Content paramsPromise={params} /></Suspense>`, with a nested async component that awaits `params` and calls the cached read. See `implementation.md` §3.
- **No server-side `Date.now()`** — v1 doesn't render any now-relative label on the released page. If one is ever added ("Released X minutes ago" / footer timestamp / cover line), it must live in a `'use client'` leaf because Cache Components rejects request-time data access in Server Components. Mirror `src/components/plans/TimeAgo.tsx` from `0003`.

## Verification

1. In editor, click Release → URL appears in banner; copy to clipboard; visit in incognito — plan renders mobile-first.
2. Visit same URL on a phone (via LAN IP / tailscale / ngrok) → layout is not split-pane; scrolls naturally; tap targets comfortable.
3. Edit the event's `remark` in the editor → refresh released URL → new remark appears.
4. Unrelease → released URL 404s.
5. Re-release → slug is a NEW random (not reused).
6. Alerts: create a plan with 1 Issue + 1 Warning → both appear in the "Heads-up" accordion of the released page.
7. Open DevTools on mobile: `<meta name="robots" content="noindex,nofollow">` present.
8. Delete the plan → released URL 404s even if the slug was known.
