# 0007 — Map pane rendering

## Context

The map pane is always visible on the left. It shows the current Day's Lodging, Events (numbered by visit order), and Travels (polylines colored by vehicle). Product §5.8 mandates the split-pane and specifies two-way sync, but sync comes in `0009`. This sub-plan establishes the map as a pure renderer from server-prepared props.

Product §§5.8 (Map pane), 5.5 (travel route path), 5.2 (distinct Lodging pin).

## Prerequisites

- `0004` (editor shell with left-pane slot).
- `0006` (Events/Travels exist so there's something to render).

## Scope

**In:**
- `MapPane` client component mounted inside the split-pane's left slot.
- `@vis.gl/react-google-maps` integration: `<APIProvider>` at the app root (client), `<Map>` inside `MapPane`.
- Pins:
  - Start Lodging: distinct icon (filled house). Single pin for start even if same as end.
  - End Lodging: only rendered if different place than start; same distinct icon variant.
  - Events: numbered markers 1…N in visit order (day's position).
- Polylines per Travel:
  - Source: `travels.routePath` (already populated by `0002` or `0012`).
  - Color by vehicle: `walk=#2563eb`, `drive=#dc2626`, `transit=#7c3aed`, `cycle=#059669`.
  - Stroke weight 4; opacity 0.85.
  - Skip drawing if `routePath` is empty (Auto Fill not yet run).
- Auto-fit bounds to day's pins + polylines on day change.
- Day selector at the top of the map (reads `currentDayId` from selection store).
- Placeholder behavior when no lodging or no events for the day: shows centered "Pick a lodging to see the map."

**Out:**
- Click / hover sync (`0009`).
- Timeline view (`0008`).
- Map for the released page (`0013` handles mobile layout separately).

## Schema / types

No new tables.

New types (`src/components/map/types.ts`):
```ts
export type MapDay = {
  dayId: string;
  startLodging: { placeId: string; lat: number; lng: number; name: string } | null;
  endLodging:   { placeId: string; lat: number; lng: number; name: string } | null;
  events: Array<{ id: string; placeId: string | null; lat: number | null; lng: number | null; name: string; visitNumber: number }>;
  travels: Array<{ id: string; vehicle: Vehicle | null; routePath: [number, number][] | null }>;
};
```

## Files

Create:
- `/Users/xuhan/code/travel-tw/src/components/map/MapProvider.tsx` — wraps `<APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}>`. Mounted in `app/layout.tsx` (conditionally, only when key is set; otherwise children render without provider and map shows a placeholder).
- `/Users/xuhan/code/travel-tw/src/components/map/MapPane.tsx` (client)
- `/Users/xuhan/code/travel-tw/src/components/map/Pin.tsx`
- `/Users/xuhan/code/travel-tw/src/components/map/Polyline.tsx` — uses Advanced Markers API via a wrapper.
- `/Users/xuhan/code/travel-tw/src/components/map/DaySelector.tsx` — dropdown shared between Map and Right pane.
- `/Users/xuhan/code/travel-tw/src/components/map/types.ts`
- `/Users/xuhan/code/travel-tw/src/lib/model/map.ts` — `getMapDay(planId, dayId)` returning `MapDay` (cached).

Modify:
- `/Users/xuhan/code/travel-tw/src/components/editor/EditorShell.tsx` — mount `MapPane` on the left; remove placeholder.
- `/Users/xuhan/code/travel-tw/src/app/layout.tsx` — mount `MapProvider`.
- `/Users/xuhan/code/travel-tw/.env.example` — note that `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is separate from the server-only `GOOGLE_MAPS_API_KEY` for client-map rendering. Document restriction (referrer-scope) in a comment.

## Implementation notes

- **Two API keys** — `GOOGLE_MAPS_API_KEY` is server-only (Places/Directions) and restricted to IP/none. `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is client-exposed (bundled into JS) and restricted to HTTP referrer. Document this in `.env.example`.
- **`NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID`** — required for Advanced Markers. Set in Google Cloud Console; add to `.env.example`.
- **Async loading** — `<APIProvider>` already handles script loading; don't add `@googlemaps/js-api-loader` manually.
- **Numbering** — Events by `position` ascending, filter those with a `placeId`, assign visit numbers 1..N in that filtered order. Unplaced events don't get a pin (no lat/lng).
- **Polyline color** — `Polyline.tsx` takes a `vehicle` prop and picks a color from a constant map. Lines for travels without a `routePath` (vehicle not chosen, or Auto Fill not run) are simply not rendered — the map shows gaps, matching product §5.6 behavior.
- **Bounds fitting** — on every `currentDayId` change: collect all lat/lngs from pins + polyline points; build a `LatLngBounds`; call `map.fitBounds(bounds, { padding: 32 })`. If only 1 point, set center + zoom 15.
- **Server-to-client hand-off** — `getMapDay` is called in the Server Component wrapper and passed to `MapPane` as a prop. `MapPane` re-renders when the prop changes (day switched) OR reads `currentDayId` from the Zustand store and fetches via a tiny client-side endpoint — **we choose prop-pass** for simplicity; day switching goes through the server refresh path because we also re-render the Table / Timeline.
- **Bundle size** — `@vis.gl/react-google-maps` is already tree-shakeable. Confirm `<MapPane />` is in a `'use client'` file and NOT imported by any server component except via JSX (JSX pass-through is fine).
- **No APIProvider key** fallback — when `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is missing, `MapPane` renders a centered placeholder message with instructions. Don't crash dev bootstrap.

## Verification

1. Open editor with a Day that has a Lodging + 3 Events → map loads centered on the bounds; a distinct Lodging pin + 3 numbered Event pins; Travels' polylines colored per vehicle only if `routePath` has been filled (typically after `0012`).
2. Remove an Event → pin disappears, numbers re-assign.
3. Add an Event without picking a Place → no pin rendered (unplaced events are silent on the map).
4. Change days via the Day selector → map re-fits to the new Day's bounds.
5. Set vehicle to `drive` on a Travel → once a `routePath` is present, polyline recolors red.
6. With the env var unset, `MapPane` shows placeholder text; rest of the app still works.
7. Verify via DevTools Network: no API requests from the client beyond the Maps JS bundle load (no unauthorized API proxying).
