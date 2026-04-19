# 0002 — Google APIs proxy & caches

## Context

The editor, Auto Fill, and PDF all depend on Google data: Places search (autocomplete + details), Place photos (downloaded once, served locally), and Directions (travel time + polyline). We must keep the API key server-side, cache aggressively to control cost, and return shapes the app can consume without re-shaping everywhere.

Product §§5.3, 5.5, 5.6; `implementation.md` §3 "Google APIs".

## Prerequisites

- `0001-foundations.md` — schema tables `places`, `places_cache`, `directions_cache` and `plan_place_overrides` exist; `GOOGLE_MAPS_API_KEY` env var is wired.

## Scope

**In:**
- `src/lib/google/places.ts` — server-side HTTP calls for Autocomplete and Place Details.
- `src/lib/google/directions.ts` — server-side Routes API call.
- `src/lib/google/staticMap.ts` — URL builder only (no network here).
- Route handlers:
  - `GET /api/places/autocomplete?q=&sessionToken=` — proxies Autocomplete.
  - `GET /api/places/details?placeId=` — fetches details, upserts into `places` and `places_cache`, returns the app shape.
  - `GET /api/places/photo/[placeId]/[idx]` — downloads the indexed photo to `public/places/{placeId}/{idx}.jpg` on first call; redirects (302) to the local path thereafter.
  - `GET /api/directions?origin=&dest=&vehicle=` — fetches Directions, upserts `directions_cache`, returns `{ travelTime, routePath }` with `travelTime` rounded up to next 15 min.
- TTL strategy: `places` row considered stale after **30 days** for hours/photos; coords/name never re-fetched (`fetched_at` touched on refresh). `directions` considered fresh **indefinitely** unless manually invalidated.
- Cache invalidation helper `src/lib/google/invalidate.ts` callable from an admin script (not a UI) if Google data changed.

**Out:**
- Any React UI — `0005` consumes these routes via `PlacePicker`.
- TZ inference — `0005` does that on Place add.
- Global scheduled cache refresh — not v1.

## Schema / types

Uses existing tables. Adds these response types (`src/lib/google/types.ts`):

```ts
export type AutocompleteHit = {
  placeId: string;
  primary: string;      // e.g. "Senso-ji Temple"
  secondary: string;    // e.g. "Asakusa, Taito, Tokyo, Japan"
};

export type PlaceDetails = {
  googlePlaceId: string;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  photos: { ref: string; width: number; height: number }[];
  hours: PlaceHours | null;
  category: string | null;
};

export type DirectionsResult = {
  travelTime: number;           // minutes, rounded up to next 15
  routePath: [number, number][]; // [lat, lng][]
  vehicle: Vehicle;
  cached: boolean;
};
```

## Files

Create:
- `src/lib/google/places.ts`
- `src/lib/google/directions.ts`
- `src/lib/google/staticMap.ts`
- `src/lib/google/types.ts`
- `src/lib/google/invalidate.ts`
- `src/app/api/places/autocomplete/route.ts`
- `src/app/api/places/details/route.ts`
- `src/app/api/places/photo/[placeId]/[idx]/route.ts`
- `src/app/api/directions/route.ts`
- `public/places/.gitkeep`

Modify:
- `.gitignore` — add `!.env.example` exception (so the example stays tracked); ignore `public/places/*` with a `!public/places/.gitkeep` exception.

## Implementation notes

- **Autocomplete** — Use the Places API (New) `autocomplete` endpoint. Accept an opaque `sessionToken` from client to reduce billing. Return a shape that strips Google's envelope. Do **not** cache autocomplete responses (per Google's billing model, sessions matter).
- **Place Details** — On request:
  1. Look up `places` by `placeId` and use `places.fetchedAt` as the freshness signal. If `fetchedAt > now - 30d`, build and return `PlaceDetails` from the existing row (log a one-line cache-hit marker). `places_cache.rawResponse` is not consulted here — it exists purely for audit/reparse.
  2. Otherwise, call the `places` endpoint with field mask `id,displayName,formattedAddress,location,photos,regularOpeningHours,primaryTypeDisplayName`.
  3. Upsert `places` via `onConflictDoUpdate`: on conflict, refresh `photos`/`hours`/`category`/`fetched_at` using `excluded.*`; **preserve** `name`/`address`/`lat`/`lng` by omitting them from the `set` clause (per "coords/name never re-fetched"). The "merge hours unless override" rule is plan-agnostic at this layer — the proxy always writes the Google value to `places.hours` and never touches `plan_place_overrides`; read-side merging (override wins) lives in `lib/model/plan.ts` in later phases. Upsert `places_cache` with the raw Google JSON.
  4. Return the `PlaceDetails` shape.
- **Photo proxy** — Params come from the Next 16 async `params`; `await` them. On first request: call Google's Places Photo Media endpoint (`…/v1/{photoName}/media?key=KEY&maxHeightPx=1600`) — the API key **must** go in the query string here; the `X-Goog-Api-Key` header is not accepted by the Media endpoint. Pipe the body to `public/places/{placeId}/{idx}.jpg` via `node:fs/promises`; then redirect to `/places/{placeId}/{idx}.jpg` (served as a static asset). On subsequent requests: `fs.stat` the file; if present, redirect immediately. Never stream bytes through the handler — let static serving do the work. `PlacePhoto.ref` stores Google's full resource `name` verbatim (e.g. `places/ChIJ.../photos/ATpl...`); the Media endpoint accepts it directly.
- **Directions** — Use Routes API (`computeRoutes`). Map our `Vehicle` to Google's `travelMode` (`walk→WALK`, `drive→DRIVE`, `transit→TRANSIT`, `cycle→BICYCLE`). Request `duration` and `polyline.encodedPolyline`, decode the polyline into `[lat, lng][]` using a lightweight decoder (copy-paste the canonical algorithm or use `@googlemaps/polyline-codec` — prefer the canonical inline to avoid a dep). Round up to next 15 min with `roundUpToQuarter` from `lib/time.ts`. Upsert `directions_cache`.
- **Cache keys** — Directions by `(origin_place_id, dest_place_id, vehicle)`. This means Auto Fill won't re-call Google for the same segment even across plans.
- **Route handler caching** — These are route handlers, not Server Components. We don't apply `'use cache'`; instead, we explicitly serve from the Drizzle caches. No need for `cacheLife` / `revalidateTag` here — the "cache" is the DB.
- **Hours mapping** — Keep Google's native weekday indexing `0 = Sunday … 6 = Saturday` in `WeeklyHours.weekday`; downstream code (alerts, PDF labels) follows the same convention. Hours windows that cross midnight (`close.day !== open.day`) are clipped at `23:59` and emitted as two entries — e.g., Tue 22:00 → Wed 02:00 becomes `{ weekday: 2, open: '22:00', close: '23:59' }` plus `{ weekday: 3, open: '00:00', close: '02:00' }`. 24/7 places (Google returns no `close`) become `{ open: '00:00', close: '23:59' }` for each returned open-only period. Any `hour === 24` normalized to `'23:59'`.
- **Error classes** — `GoogleConfigError` (missing `GOOGLE_MAPS_API_KEY` → 500), `GoogleUpstreamError` (non-2xx from Google → 502), and `PlaceNotFoundError` (Google 404 → 404) are exported from `src/lib/google/places.ts`. `NoRouteError` (empty `routes: []` → 404) is exported from `src/lib/google/directions.ts`. Each route handler maps these to their HTTP status in a top-level `try/catch`.
- **Error handling** — Return `{ error: string }` + 4xx/5xx. Log with `console.error` for now.
- **Security** — Every handler checks `GOOGLE_MAPS_API_KEY` is set; returns 500 with clear message if not. Never echo the key in responses.
- **Photo directory layout** — `public/places/{placeId}/{0…N}.jpg`. We retain Google's ordering. Write atomically (temp file + `rename`).

## Verification

1. Set `GOOGLE_MAPS_API_KEY` and `DATABASE_URL`. Boot dev server.
2. `curl 'http://localhost:3000/api/places/autocomplete?q=senso&sessionToken=abc'` → JSON array of `AutocompleteHit`s.
3. Pick a `placeId` from the response; `curl 'http://localhost:3000/api/places/details?placeId=XYZ'` → first call returns `PlaceDetails`; `places` and `places_cache` rows appear in DB. Second call returns immediately (log should indicate cache hit).
4. `curl -i http://localhost:3000/api/places/photo/XYZ/0` → 302 redirect to `/places/XYZ/0.jpg`; file exists under `public/places/XYZ/`. Second call same, but no Google request (verify via log).
5. `curl 'http://localhost:3000/api/directions?origin=PLACE_A&dest=PLACE_B&vehicle=walk'` → JSON with `travelTime` a multiple of 15; `directions_cache` row appears; second call reports `cached: true`.
6. Confirm `.env.example` mentions `GOOGLE_MAPS_API_KEY`; missing it → 500 with a clear error.
