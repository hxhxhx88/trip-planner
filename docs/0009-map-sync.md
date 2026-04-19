# 0009 — Map ↔ right-pane sync

## Context

Product §5.8 requires two-way interaction between the Map and the right pane:
- **Right → Map**: clicking an Event/Travel/Lodging in Table or Timeline pans and zooms the Map and highlights the matching pin/polyline.
- **Map → Right**: clicking a pin or polyline scrolls the right pane to the item and visually highlights it.
- **Hover** (secondary): lightweight highlight on the other side, no pan.
- **Persistence**: the highlighted item stays highlighted across Table↔Timeline toggles.

## Prerequisites

- `0006` (Table).
- `0007` (Map).
- `0008` (Timeline).

## Scope

**In:**
- Shared Zustand selection store (created in `0004`, extended here with `selectSource` + 50 ms in-store hover debounce).
- Bidirectional event wiring:
  - `MapPane`: click pin → `select(entityId, 'map')`; click polyline → `select(travelId, 'map')`; hover → `hover(id)`.
  - `TableView` / `TimelineView`: click row/block → `select(id, 'pane')`; hover → `hover(id)`.
  - Timeline click was previously wired in `0008` to also flip the view to Table; this milestone drops that side-effect (see "Click-to-table tension" below).
- `MapPane` effect (`PanToSelected` child): when `selectedId` changes **and** `selectSource !== 'map'`, if the entity has a lat/lng (Event or Lodging) pan to it and zoom to `max(15, currentZoom)`; if a Travel, fit bounds to its route with padding 48. `hoveredId` only styles the marker without moving the map.
- `TableView` / `TimelineView` effect: when `selectedId` changes, scroll the matching element into view with `block: 'nearest'`. (The `block: 'nearest'` option is a no-op when the element is already visible, so this fires unconditionally — no need to gate on `selectSource`.)
- Visual treatments:
  - Selected pin: outer glow ring (Tailwind `ring-4 ring-primary/70` on a wrapper around `<Pin>`).
  - Selected Event row: left border accent + subtle background tint (`border-primary bg-primary/5`).
  - Selected Travel row: border-left swaps from `border-muted` to `border-primary`.
  - Selected polyline: stroke weight 4→5, opacity 0.85→1.0.
  - Hovered: subtler versions of the same (ring-2 on pins; `bg-muted/30` on rows).
- Clear-selection on blank map click — `<Map onClick>` calls `select(null, 'map')`. Google Maps naturally does **not** bubble marker/polyline clicks to the map handler, so no extra "ignore events from markers" logic is needed.
- Day selector shared: `DaySelector` at the top of the Map (already built in `0007`) and in the right-pane header; both read/write `currentDayId`.

**Out:**
- Released page interactions (`0013`): no sync required — released page is a scrolled list, not split-pane.
- Multi-select: v1 is single-select only.

## Schema / types

No new tables. Extends the Zustand store established in `0004`:

```ts
type SelectSource = 'map' | 'pane' | null;

type SelectionState = {
  currentDayId: string | null;
  selectedId: string | null;
  selectSource: SelectSource;   // added in 0009: where the current selection came from
  hoveredId: string | null;
  setCurrentDay(id: string | null): void;
  select(id: string | null, source?: 'map' | 'pane'): void;   // default 'pane'
  hover(id: string | null): void;                              // debounced 50ms inside the store
};
```

`setCurrentDay` clears `selectedId`, `selectSource`, and `hoveredId` (the selected entity is likely no longer rendered on the new day). `select(null)` also nulls `selectSource`.

### Lodging id convention

Lodging rows and pins are not DB rows with their own ids, but they are selectable. The Map (`toMapDay`) and Timeline (`toTimelineModel`) already stamp them with synthetic ids of the form `lodging-start:${dayId}` and `lodging-end:${dayId}`. This milestone extends the **Table**'s `LodgingRow` to use the same ids so a pin click resolves to the correct row (and vice versa).

## Files

Modify (no new files):
- `src/stores/selection.ts` — add `selectSource`; make `select(id, source?)` accept a source (default `'pane'`); move the 50 ms hover debounce into the setter so all callers get it automatically.
- `src/components/map/MapPane.tsx` — subscribe to `selectedId`/`hoveredId`/`selectSource`; pass them + click/hover handlers to pins and polylines; add `<Map onClick>` that clears selection with source `'map'`; mount a new `PanToSelected` child (uses `useMap()`) that pans/zooms or fits-bounds on selection change and skips when `selectSource === 'map'`.
- `src/components/map/Pin.tsx` — `LodgingPin` + `EventPin` accept `selected`, `hovered`, `onClick`, `onHover`; wire `AdvancedMarker`'s `onClick` / `onMouseEnter` / `onMouseLeave`; wrap the `<Pin>` in a halo div that gets `ring-4 ring-primary/70` (selected) or `ring-2 ring-primary/40` (hovered).
- `src/components/map/Polyline.tsx` — accept `selected`, `hovered`, `onClick`, `onHover`; bump `strokeWeight` 4→5 and `strokeOpacity` 0.85→1.0 when selected; vis.gl's `<Polyline>` uses `onMouseOver` / `onMouseOut` (not enter/leave) for hover.
- `src/components/editor/TableView.tsx` — read `selectedId`/`hoveredId`; pass `selected` / `hovered` / `onSelect(id, 'pane')` / `onHover` to each row; collect row refs via a shared `registerRef` callback; `useEffect` scrolls the selected row into view on `selectedId` change.
- `src/components/editor/EventRow.tsx`, `TravelRow.tsx`, `LodgingRow.tsx` — each row's root `<div>` now gets `onClick` / `onMouseEnter` / `onMouseLeave` / a ref callback; conditional classes for selected and hovered states. `LodgingRow` gains an `id` prop (`lodging-start:${dayId}` / `lodging-end:${dayId}`); `LodgingRow` also gains `"use client"`.
- `src/components/editor/TimelineView.tsx` — rename `onOpenInTable` → `onSelect`; collect refs via `registerRef` callback passed to `EventBlock` / `TravelConnector` / `UnscheduledPill`; `useEffect` scrolls the selected element into view.
- `src/components/editor/timeline/EventBlock.tsx`, `TravelConnector.tsx`, `UnscheduledPill.tsx` — each accepts `registerRef(id, el)` and wires it to its root clickable element.
- `src/components/editor/DayContent.tsx` — `handleOpenInTable` becomes `handleSelect(id)` = `useSelection.getState().select(id, 'pane')`; the `setView('table')` call is removed (see "Click-to-table tension" below).
- `src/components/map/DaySelector.tsx`, `src/components/editor/DayTabs.tsx` — already read/write `currentDayId`; no changes.

## Implementation notes

- **Selection id namespace** — `selectedId` stores a domain id without a type prefix; the type is inferred from the current day composition (event id / travel id / synthetic `lodging-*:<dayId>`). Alternative (flagged if ambiguity arises): namespace as `event:<id>` / `travel:<id>` / `lodging:<id>`. Started without; no collisions observed, keep as-is.
- **Pan / zoom** — call `map.panTo({lat, lng})` then `map.setZoom(Math.max(15, currentZoom ?? 0))`. For polylines, build a `google.maps.LatLngBounds` from `routePath` and call `map.fitBounds(bounds, 48)`. Google Maps cancels any in-flight pan when a new `panTo` fires, so no explicit debouncing is needed on rapid successive selections.
- **Scroll into view** — `el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })`. `block: 'nearest'` is a no-op when the element is already visible, so the effect can fire on every `selectedId` change (including when the source was the same pane) without visible churn. TableView and TimelineView each keep a `Map<string, HTMLElement>` populated through a shared `registerRef(id, el)` callback.
- **Hover latency** — the `hover` setter itself is debounced by 50 ms inside `stores/selection.ts` using a module-scoped `setTimeout`. Every caller (Map pin, Polyline, row, block, connector) therefore gets the same debounce without each site needing its own `useDebouncedCallback` wrapper.
- **Click capture** — `<Map onClick>` calls `select(null, 'map')`. Google Maps does not bubble marker / polyline clicks to the Map's click handler, so no "ignore clicks from our own overlays" check is needed — the Map click fires only on the background.
- **Selection source tracking** — `selectSource` exists specifically to suppress the `PanToSelected` effect when the user clicked a pin on the Map (`'map'`). Scroll-into-view on the right side is left unguarded because `block: 'nearest'` already no-ops when in view. This keeps the Table↔Timeline toggle re-scrolling the selected entity into view when the user flips views manually.
- **Selection continuity across day switch** — `setCurrentDay(id)` clears `selectedId`, `selectSource`, and `hoveredId` together. The selected entity is almost always gone after a day switch.
- **Performance** — at N events ~20, no issues expected. Virtualization not needed.
- **Click-to-table tension — resolved as option (b).** In `0008`, a single-click in Timeline both selected the entity AND flipped the view to Table. Once the Map reacts to `selectedId`, that flip yanks the user out of Timeline every time they click a block to inspect its position on the map. We chose option (b): a plain Timeline click now just selects (and pans the map); the `ViewToggle` is the only mechanism that switches views. `DayContent.handleOpenInTable` was renamed to `handleSelect` and the `setView('table')` line removed. Shift-click and Cmd-click variants were considered and deferred — discoverability was too low to be worth it.

## Verification

1. Click an Event row → Map pans/zooms to that pin; pin gets a glow; row gets an accent.
2. Click a different row → pan transitions; previous pin returns to normal.
3. Click the pin of Event #3 on the Map → right pane scrolls so Event #3 row is visible; row gets accent; map pan is skipped (click originates on map).
4. Hover an Event row → pin gets subtle highlight; no pan.
5. Toggle Table → Timeline → selected Event's block is outlined; toggle back → Table row still accented.
6. Click empty map area → selection clears (rows deaccent); pin glows removed.
7. Switch to another Day → selection clears; Map refits new day's bounds.
8. Click a polyline → selection = that travel id; Map re-fits to the travel's bounds; right pane scrolls to the Travel row (Table) or connector (Timeline).
