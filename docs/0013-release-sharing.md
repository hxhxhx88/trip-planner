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
  - Header: trip name, date range, tz, "Download PDF" button (wired in `0015`).
  - Per-Day sections, vertically stacked, scrollable. Each section has: Day title, Lodging card (start + end if distinct), Event cards in order, Travel connectors between them.
  - An Event card shows: time range, Place name, photo (first local photo), short description, remark, alert dot(s) and tapped expansion showing messages.
  - A Travel connector shows: vehicle icon, travel time, alert dot (e.g. `travel_missing_vehicle`).
  - Empty time between travels and next events is visually represented with a small "free time: 30 min" chip (to mirror Timeline behavior).
- Alerts on shared page: grouped into a "Heads-up" accordion at the top of each Day (all alerts Day-scoped and narrower), plus inline dots on each card. Shows both Issues and Warnings (per §8 resolution).
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
- `src/app/p/[slug]/layout.tsx` — mobile-tuned container + metadata.
- `src/components/released/ReleasedDay.tsx`
- `src/components/released/ReleasedEventCard.tsx`
- `src/components/released/ReleasedTravelConnector.tsx`
- `src/components/released/ReleasedLodgingCard.tsx`
- `src/components/released/ReleasedAlerts.tsx`
- `src/components/editor/ReleaseBanner.tsx`
- `src/lib/model/released.ts` — `getPlanBySlug(slug)`: cached with `cacheTag('release:${slug}')` AND `cacheTag('plan:${planId}')` so edits to the plan (which already call `updateTag('plan:${planId}')`) invalidate the released view automatically.

Modify:
- `src/components/editor/EditorShell.tsx` — mount `ReleaseBanner`.

## Implementation notes

- **Slug generation** — 16-char `nanoid` with the url-safe alphabet (`lib/slug.ts`). Verify uniqueness before setting (retry on collision); collisions are astronomically rare but keep the guard.
- **`releasePlan`** — idempotent: if already released, returns current slug. Returns `{ slug, url }`.
- **`unreleasePlan`** — clears `releasedSlug`. Invalidates the cache tag for the old slug.
- **Cache tagging strategy** — `getPlanBySlug(slug)` uses BOTH `release:${slug}` and `plan:${planId}` tags. Any planner-side edit (which already invalidates `plan:${planId}`) flushes the released view automatically. No extra bookkeeping.
- **Slug cache lookup** — server component resolves `slug → planId` once (cached in a small `getPlanIdBySlug(slug)` with its own tag). Then the real `getPlanForReleased(planId)` does the heavy lift.
- **Mobile-first** — Tailwind: `w-full max-w-md mx-auto` container; cards use full width on small screens. Use `text-base/6` body and larger tap targets. No hover-dependent UI.
- **Photo display** — `next/image` served from `/places/{placeId}/0.jpg`. Lazy-load below the fold.
- **Open Graph** — pick a good cover photo (first Day's first placed Event). Fallback to plain color card with trip name.
- **Live edits** — the released page always queries the live plan; edits in the editor appear on next reload. Test: edit a Place description in the editor; refresh `/p/{slug}` on a phone; change visible.
- **`notFound()`** — if `getPlanIdBySlug` returns null, call `notFound()` (Next 16 async-aware). Renders `not-found.tsx` or a local `p/[slug]/not-found.tsx` for a friendlier message.
- **Suspense-async-params pattern** — `/p/[slug]/page.tsx` is a dynamic route under Cache Components. Follow the same shape established by `0003`'s settings page and `0004`'s editor page: a synchronous default export that returns `<Suspense fallback={…}><Content paramsPromise={params} /></Suspense>`, with a nested async component that awaits `params` and calls the cached read. See `implementation.md` §3.
- **No server-side `Date.now()`** — the "Released X minutes ago" / footer timestamp / cover line must not call `formatDistanceToNow` or `new Date()` in a Server Component (Cache Components rejects it). Use a client `TimeAgo`-style leaf, mirroring `src/components/plans/TimeAgo.tsx` from `0003`.

## Verification

1. In editor, click Release → URL appears in banner; copy to clipboard; visit in incognito — plan renders mobile-first.
2. Visit same URL on a phone (via LAN IP / tailscale / ngrok) → layout is not split-pane; scrolls naturally; tap targets comfortable.
3. Edit the event's `remark` in the editor → refresh released URL → new remark appears.
4. Unrelease → released URL 404s.
5. Re-release → slug is a NEW random (not reused).
6. Alerts: create a plan with 1 Issue + 1 Warning → both appear in the "Heads-up" accordion of the released page.
7. Open DevTools on mobile: `<meta name="robots" content="noindex,nofollow">` present.
8. Delete the plan → released URL 404s even if the slug was known.
