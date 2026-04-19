# 0005 — Places picker, hours override, photo pipeline

## Context

Every Place comes from Google (product §5.3: "Google Places search only"). The editor reuses one `PlacePicker` in three locations: per-day start Lodging, per-day end Lodging, and per-event Place selection. Users can override business hours per-Plan when Google's data is wrong (per-Plan scope per §8 resolution). Place photos are downloaded locally on first reference so PDFs are self-contained.

Product §§5.2 (Lodging uses Place picker), 5.3 (Places), 5.4 (Event.Place), §6 (TZ inference).

## Prerequisites

- `0001` (schema, shared types).
- `0002` (proxy routes for autocomplete, details, photos).
- `0004` (editor shell with empty Lodging slots).

## Scope

**In:**
- `PlacePicker` component — controlled popover with:
  - Search input calls `/api/places/autocomplete` with a session token (generated per-pick).
  - Suggestion list with primary + secondary text.
  - On select, calls `/api/places/details?placeId=` to confirm and hydrate. Displays a preview card (name, address, category, hours summary, first photo).
- `HoursEditor` — a sheet/popover showing the effective hours for this Plan (Google's hours merged with any override). Allows per-weekday open/close edits; saved as a row in `plan_place_overrides`.
- `LodgingSlot` upgraded to use `PlacePicker` (picks start and end Lodgings). Includes an "Inherit from prev day" button when previous day's Lodging is known.
- TZ inference: first Place added to a Plan (in any slot) triggers `inferTimezoneIfUnset(planId, lat, lng)`. Uses `geo-tz` (add dep) to map lat/lng to IANA zone. No-op if plan has a non-default TZ already (tracked via a `tzSetByUser` boolean on `plans`).
- Photo pipeline — when `/api/places/details` hydrates a new Place, the first photo is requested in-background (fire-and-forget) via `/api/places/photo/{placeId}/0` so the file is already local before PDF/editor rendering. Subsequent photos pulled lazily as the UI references them.
- Reusable `PlacePreview` component (shared with editor, released page, PDF) displaying: name, address, hours (with override indicator), first photo.

**Out:**
- Event rows (`0006`).
- Actual Map rendering (`0007`).
- Released-page photo rendering (`0013`).

## Schema / types

Schema — adds one column to `plans`:

```ts
// schema.ts (ALTER)
export const plans = pgTable('plans', {
  // ...existing fields...
  tzSetByUser: boolean('tz_set_by_user').default(false).notNull(),
});
```

Migration: `drizzle-kit generate` — a new migration applying the column with default `false`.

Types (`src/lib/google/types.ts` already has `PlaceDetails`, `PlaceHours`):
```ts
export type EffectiveHours = {
  source: 'google' | 'override';
  hours: PlaceHours | null;
};
```

## Files

Create:
- `src/components/places/PlacePicker.tsx`
- `src/components/places/PlacePreview.tsx`
- `src/components/places/HoursEditor.tsx`
- `src/lib/model/places.ts` — `getEffectiveHours(planId, placeId)`; merges `plan_place_overrides` over `places.hours`.
- `src/actions/places.ts` — `setHoursOverride`, `clearHoursOverride`, `ensurePhoto(placeId, idx)` (server-only helper; not a UI action).
- `src/lib/geo/inferTz.ts` — wraps `geo-tz`.

Modify:
- `src/db/schema.ts` — add `tzSetByUser` to `plans`.
- `src/actions/plans.ts` — `setPlanTimezone` sets `tzSetByUser = true`.
- `src/actions/days.ts` — `setDayLodging` (start|end) calls `inferTimezoneIfUnset` after successful upsert.
- `src/components/editor/LodgingSlot.tsx` — wire `PlacePicker` in, add "Inherit from prev day" button.
- `package.json` — add `geo-tz` dep.
- `next.config.ts` — add `"geo-tz"` to `serverExternalPackages`. `geo-tz` bundles native timezone shapefiles that Next / Turbopack cannot resolve through the module graph; leaving it external keeps it as a plain Node `require` at runtime.

## Implementation notes

- **Session tokens** — generated client-side via `crypto.randomUUID()` per picker instance (new one each time the popover opens). Passed to autocomplete. Not kept.
- **Autocomplete UX** — debounce 250ms. Show 5 results. Keyboard: ↑/↓ navigate, Enter selects.
- **Detail fetch** — on selection, show a skeleton preview for ~200ms, then render the preview card. User confirms via "Use this place" button.
- **Hours editor** — rendered as a popover from the Place preview. Layout: 7 rows (Mon–Sun), each with Open / Close / Closed toggles. Effective hours displayed with small `(override)` badge when sourced from `plan_place_overrides`.
- **`getEffectiveHours`** — query override first; fall back to `places.hours`. Returns `{ source, hours }`.
- **Photo pipeline** — `ensurePhoto` calls `/api/places/photo/{placeId}/{idx}` via `fetch` from the server (yes — self-fetch is fine in dev/prod). Fire-and-forget on first detail hydration for `idx=0`. UI components read `/places/{placeId}/{idx}.jpg` directly via `next/image` (remotePatterns isn't needed for same-origin static).
- **TZ inference** — only on first Place ever added to a plan AND `tzSetByUser === false`. Logs the old→new zone for audit. If the plan already has events with times, call `rebaseTimesAcrossTz` (from `0003`) inside the same transaction.
- **Inherit previous day's lodging** — button in `LodgingSlot` enabled when `day.position > 0` and the previous day has non-null lodging; copies both start+end in one action call.
- **Cache invalidation** — `setHoursOverride` calls `updateTag(\`plan:\${planId}\`)`. `setDayLodging` does the same.

## Verification

1. In editor, click "Pick lodging" → search "Park Hyatt Tokyo" → select. Preview shows address, hours, photo. Confirm → slot shows place name + address.
2. DB: `plans.tzSetByUser` is `true` if TZ inferred; `places` row exists; a `public/places/{id}/0.jpg` file appears within ~2s.
3. Add a second day → click "Inherit from prev day" → lodging copies instantly (one action call; no extra network to Google).
4. Open `HoursEditor` for a Place → override Monday's close to 22:00 → save. Preview shows `(override)` badge. Switch to a different Plan referencing the same Place → its preview shows original Google hours (per-Plan scope confirmed).
5. Change TZ via settings → dates/times rebase; `tzSetByUser` stays `true`.
6. Inspect network: autocomplete requests use same session token across keystrokes within one popover open.
7. Delete and re-add the same Place → no duplicate `places` row; second pick reuses cache (no Google call — confirm via server log).
