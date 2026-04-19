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

New types (`src/components/map/types.ts`) — shaped post-filter (only renderable entities are present, so nullable lat/lng/routePath are resolved in the helper rather than in the type):
```ts
import type { Vehicle } from "@/lib/schemas";

export type MapPin        = { id: string; lat: number; lng: number; name: string };
export type MapEventPin   = MapPin & { visitNumber: number };
export type MapTravelLine = { id: string; vehicle: Vehicle | null; routePath: [number, number][] };

export type MapDay = {
  dayId: string;
  startLodging: MapPin | null;
  endLodging:   MapPin | null;             // null when same place as start (§5.2 single-pin rule)
  events:       MapEventPin[];             // 1..N numbered in position order; unplaced events excluded
  travels:      MapTravelLine[];           // only travels whose routePath is non-null and ≥ 2 points
};
```

## Files

Create:
- `src/components/map/MapProvider.tsx` — `"use client"`. Always mounted in `app/layout.tsx`; internally wraps children in `<APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}>` when the key is present, and returns `children` unchanged when it is not. `MapPane` renders a self-contained placeholder in the no-key path, so no context layering is required.
- `src/components/map/MapPane.tsx` (`"use client"`) — top-level pane. Takes `data: PlanForEditor` as a prop (same shape the placeholder consumed), reads `currentDayId` from the selection store, and derives the per-day view model client-side via `toMapDay`. Mounts `<Map>` with overlays + a nested `FitBounds` child that uses `useMap()` to fit bounds on day / geometry change.
- `src/components/map/Pin.tsx` — two exports: `LodgingPin` (dark `<AdvancedMarker>` with a filled `HomeIcon` glyph) and `EventPin` (blue marker with the `visitNumber` as the glyph). Both use vis.gl's `<AdvancedMarker>` + `<Pin>` primitives.
- `src/components/map/Polyline.tsx` — thin wrapper around vis.gl's declarative `<Polyline>` component (shipped in v1.8+). Maps `vehicle → color` (`walk=#2563eb`, `drive=#dc2626`, `transit=#7c3aed`, `cycle=#059669`) and converts our `[lat, lng][]` payload to `{ lat, lng }[]` at the boundary. Renders nothing when `vehicle` is null or `routePath.length < 2`.
- `src/components/map/DaySelector.tsx` — `"use client"`. Dropdown (shadcn `DropdownMenu`) in the map pane header. Reads/writes `currentDayId` via `useSelection`; items read `"Day N · MMM d"`. `DayTabs` (right pane, from 0006) is unchanged — both UIs are backed by the same store.
- `src/components/map/types.ts` — `MapPin`, `MapEventPin`, `MapTravelLine`, `MapDay`.
- `src/lib/model/map.ts` — pure client-safe helper `toMapDay(data: PlanForEditor, dayId: string | null): MapDay | null`. No `'use cache'`, no DB. Derives the day's pins + polylines from the already-fetched `PlanForEditor`; single-pin deduplication when `startLodgingPlaceId === endLodgingPlaceId`; visit numbers assigned 1..N across position-sorted events that have a placed `places[placeId]` with non-null lat/lng.

Modify:
- `src/components/editor/EditorShell.tsx` — mount `MapPane` on the left (both in the empty-days and populated branches) in place of `MapPanePlaceholder`; delete the placeholder file.
- `src/app/layout.tsx` — wrap `{children}` (alongside `TooltipProvider`) in `<MapProvider>`.
- `.env.example` — add `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` alongside `GOOGLE_MAPS_API_KEY` (the server-only key from 0002) and `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` (from 0001). Document restriction scopes (referrer for the client key, IP or unrestricted for the server key) in comments.

Install:
- `pnpm add @vis.gl/react-google-maps` — chosen in `implementation.md` §2 but deferred to this milestone. Version ≥ 1.8.3 (declarative `<Polyline>` component ships from that release).
- `pnpm add -D @types/google.maps` — vis.gl declares this as a transitive dep, but pnpm does not hoist type packages to `node_modules/@types/`, so the `google.maps` global namespace (used by our `FitBounds` child that constructs `google.maps.LatLngBounds`) does not resolve in TypeScript without an explicit direct dependency.

## Implementation notes

- **Two API keys** — `GOOGLE_MAPS_API_KEY` is server-only (Places/Directions) and restricted to IP/none. `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is client-exposed (bundled into JS) and restricted to HTTP referrer. Document this in `.env.example`.
- **`NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID`** — required for Advanced Markers. Set in Google Cloud Console; add to `.env.example`.
- **Async loading** — `<APIProvider>` already handles script loading; don't add `@googlemaps/js-api-loader` manually.
- **Numbering** — Events by `position` ascending, filter those with a `placeId`, assign visit numbers 1..N in that filtered order. Unplaced events don't get a pin (no lat/lng).
- **Polyline color** — `Polyline.tsx` takes a `vehicle` prop and picks a color from a constant map. Lines for travels without a `routePath` (vehicle not chosen, or Auto Fill not run) are simply not rendered — the map shows gaps, matching product §5.6 behavior.
- **Bounds fitting** — on every `currentDayId` / geometry change: collect all lat/lngs from pins + polyline points; build a `LatLngBounds`; call `map.fitBounds(bounds, 32)` (padding argument). If only 1 point, `setCenter` + `setZoom(15)`. Lives in a `FitBounds` child inside `<Map>` so it can call `useMap()`; depends on `mapDay` (memoised from `data` + `resolvedDayId`), so reference equality triggers re-fit.
- **Server-to-client hand-off** — `MapPane` receives the existing `PlanForEditor` as a prop (identical to what `MapPanePlaceholder` consumed) and derives the per-day view model with the pure `toMapDay` helper. **This deliberately deviates from the originally-drafted "cached `getMapDay` with server refresh on day switch" approach**: the 0006 editor wires day switching entirely through Zustand (`setCurrentDay` → all subscribers re-render from already-fetched data, no `router.refresh()`), and the map mirrors that pattern for consistency. No new server fetch fires on day change.
- **Bundle size** — `@vis.gl/react-google-maps` is already tree-shakeable. Confirm `<MapPane />` is in a `'use client'` file and NOT imported by any server component except via JSX (JSX pass-through is fine).
- **No APIProvider key** fallback — when `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is missing, `MapPane` renders a centered placeholder message with setup instructions. Don't crash dev bootstrap.
- **Missing Map ID** — `<AdvancedMarker>` requires `mapId`. If `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` is unset the `<Map>` still renders but pins won't appear; `.env.example` documents the requirement alongside the key.

## Verification

1. Open editor with a Day that has a Lodging + 3 Events → map loads centered on the bounds; a distinct Lodging pin + 3 numbered Event pins; Travels' polylines colored per vehicle only if `routePath` has been filled (typically after `0012`).
2. Remove an Event → pin disappears, numbers re-assign.
3. Add an Event without picking a Place → no pin rendered (unplaced events are silent on the map).
4. Change days via the Day selector → map re-fits to the new Day's bounds.
5. Set vehicle to `drive` on a Travel → once a `routePath` is present, polyline recolors red.
6. With the env var unset, `MapPane` shows placeholder text; rest of the app still works.
7. Verify via DevTools Network: no API requests from the client beyond the Maps JS bundle load (no unauthorized API proxying).
