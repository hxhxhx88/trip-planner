# 0016 — Polish & end-to-end verification

## Context

Final pass: tighten loading / error UX, apply `unstable_instant` where it helps, make sure images load fast and don't regress CLS, and walk through every §9 scenario end-to-end. Nothing is "done" until the verification pass goes green.

Product §9 (verification).

## Prerequisites

All previous sub-plans (0001–0015).

## Scope

**In:**
- `unstable_instant = { prefetch: 'static' }` audited and exported from:
  - `/page.tsx` (plans list)
  - `/plans/[planId]/edit/page.tsx`
  - `/p/[slug]/page.tsx`
  For each, confirm no uncached request APIs block the static shell; wrap any dynamic reads behind `<Suspense>`.
- `loading.tsx` per major route: `/`, `/plans/[planId]/edit`, `/p/[slug]` — simple shadcn skeletons.
- `error.tsx` per major route — friendly fallback with a "Reload" button.
- Image optimization: `next/image` on every Place photo with `sizes` attribute; `priority` on the released-page cover.
- Small-screen polish on editor: editor stays desktop-first; on screens < 1024px, show a "The planner works best on a larger screen — use a released URL on mobile." banner.
- Keyboard shortcuts in editor: `T` → Table, `Shift+T` → Timeline, `A` → Auto Fill, `N` → add Event, `Cmd+Enter` → submit active field.
- Favicon + og:image defaults.
- Final walkthrough of all 7 §9 verification scenarios documented below.

**Out:**
- E2E test suite (deferred to post-v1).
- Additional perf tuning beyond `next/image`.

## Schema / types

None.

## Files

Modify (no new files beyond `loading.tsx`/`error.tsx`):
- `/Users/xuhan/code/travel-tw/src/app/loading.tsx` (for `/`)
- `/Users/xuhan/code/travel-tw/src/app/plans/[planId]/edit/loading.tsx`
- `/Users/xuhan/code/travel-tw/src/app/p/[slug]/loading.tsx`
- `/Users/xuhan/code/travel-tw/src/app/plans/[planId]/edit/error.tsx`
- `/Users/xuhan/code/travel-tw/src/app/p/[slug]/error.tsx`
- `/Users/xuhan/code/travel-tw/src/app/page.tsx` — export `unstable_instant`.
- `/Users/xuhan/code/travel-tw/src/app/plans/[planId]/edit/page.tsx` — export `unstable_instant`.
- `/Users/xuhan/code/travel-tw/src/app/p/[slug]/page.tsx` — export `unstable_instant`.
- `/Users/xuhan/code/travel-tw/src/components/editor/EditorShell.tsx` — desktop-first banner + keyboard shortcuts.
- `/Users/xuhan/code/travel-tw/src/components/places/PlacePreview.tsx` — `priority` / `sizes` where appropriate.
- `/Users/xuhan/code/travel-tw/public/favicon.ico` (optional, simple).

## Implementation notes

- **`unstable_instant` audit** — before exporting, run the route in prod build and confirm Next's validator doesn't flag blocking fetches. If a route needs request-time data (e.g. the released page may need server date for "today" hours), isolate that behind a `<Suspense>` fallback so the static shell is still static.
- **Skeletons** — not pixel-perfect; match component boundaries (rows, cards) with shadcn `Skeleton`. 300ms fade-in to avoid flashing for fast responses.
- **`error.tsx`** — logs `error.digest` (Next 16 supplies it); shows plain-English fallback. For the released page, the error state is user-visible — keep it friendly.
- **Keyboard shortcuts** — implement via a single `useKeydown` hook wired in `EditorShell`. Ignore keys while focus is inside an `<input>` / `<textarea>` (check `document.activeElement`).
- **Image priorities** — first photo above the fold gets `priority`; the rest are lazy. Set `sizes="(max-width: 768px) 100vw, 320px"` for released cards.
- **CLS budget** — `next/image` with explicit `width`/`height` on the PlacePreview; check Lighthouse ≥ 90.

## Verification — §9 scenarios

Walk these on a clean DB with a fresh plan. Each should go green before we consider v1 shipped.

### Scenario 1 — Happy path
Create "Tokyo 3-day". Add 3 Days. Each day: pick a Lodging, add 3 Events with partial times, pick vehicles for each Travel. Click Auto Fill. Expect 0 Issues. Click Release. Copy URL. Open released URL in incognito on desktop and mobile; both render read-only. Click Download PDF. Open the PDF — every page renders: cover, overview, 3 per-day pages, footer. **Pass criteria: no errors; all entities populated; PDF opens cleanly.**

### Scenario 2 — Conflict path
Place a restaurant at 14:30 at a venue whose Google hours close at 14:00. Expect an Issue in Table, Timeline, the released view, and the PDF footer's alert count. **Pass criteria: alert text names both the venue and its close time.**

### Scenario 3 — Partial path
Create a Day with 3 Events, leave stay duration blank on the middle one, set start times only on Event 1 and Event 3. Click Auto Fill. Expect `cascade_unresolved` Issue on Event 2's duration. **Pass criteria: alert message is specific; other events' values untouched.**

### Scenario 4 — Edit-after-release
Release a plan. On the editor, change an event's description. Reload the released URL on desktop and on phone — both show the new description. **Pass criteria: no stale content; no cache staleness visible.**

### Scenario 5 — Gap path
Arrange Event 1 end 17:00 + 30-min Travel + Event 2 start 18:00 (venue opens at 18:00) → Timeline shows 30-min blank space; no alert. Extend to 90-min gap → Warning "Gap of 90 min before Event 2". **Pass criteria: 30-min silent; ≥ 60-min warns.**

### Scenario 6 — Planner map interaction
Click an Event in the right pane → Map pans/zooms + pin highlighted. Click a pin on Map → right pane scrolls to Event + highlight. Toggle Table ↔ Timeline → highlight persists. **Pass criteria: no lost selection; animations complete under 500ms.**

### Scenario 7 — Released mobile
Open unlisted URL on a phone. Layout is mobile-first (NOT split-pane). Scroll through days, tap an event card to expand its remark, tap Download PDF, open PDF on the phone. **Pass criteria: no horizontal scroll; tap targets ≥ 44pt; photos load; PDF opens in mobile browser.**

## General polish checklist

- [ ] All routes export valid `unstable_instant` where applicable.
- [ ] All dynamic routes `await` their `params`.
- [ ] All action mutations call `updateTag(\`plan:\${planId}\`)`.
- [ ] `editor` renders without console warnings in React strict mode.
- [ ] `/` loads in < 1s on dev localhost.
- [ ] Lighthouse mobile Perf ≥ 80 on `/p/[slug]`.
- [ ] Favicon + og:image present.
- [ ] `AGENTS.md` / `CLAUDE.md` still reference the in-repo docs workflow.
- [ ] `README.md` updated with setup (DB, env vars, `pnpm dev`), usage tour, and pointer to `docs/implementation.md`.
