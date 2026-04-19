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
- Shared Zustand selection store (created in `0004`, consumed here fully).
- Bidirectional event wiring:
  - `MapPane`: click pin → `select(entityId)`; click polyline → `select(travelId)`; hover → `hover(id)`.
  - `TableView` / `TimelineView`: click row/block → `select(id)`; hover → `hover(id)`.
- `MapPane` effect: when `selectedId` changes, if the entity has a lat/lng (Event or Lodging) pan to it with animated zoom; if a Travel, fit bounds to its route. `hoveredId` only styles the marker without moving the map.
- `TableView` / `TimelineView` effect: when `selectedId` changes and the element is not in view, scroll it into view with `block: 'nearest'`.
- Visual treatments:
  - Selected pin: outer glow ring.
  - Selected Event row: left border accent + subtle background tint.
  - Selected polyline: stroke weight +1, opacity 1.0.
  - Hovered: subtle version of the same.
- Clear-selection on blank map click (keep selection on blank right-pane click — it's often where users start editing).
- Day selector shared: `DaySelector` at the top of the Map (already built in `0007`) and in the right-pane header; both read/write `currentDayId`.

**Out:**
- Released page interactions (`0013`): no sync required — released page is a scrolled list, not split-pane.
- Multi-select: v1 is single-select only.

## Schema / types

No new tables. Reuses the Zustand store:

```ts
type SelectionState = {
  currentDayId: string | null;
  selectedId: string | null;
  hoveredId: string | null;
  setCurrentDay(id: string): void;
  select(id: string | null): void;
  hover(id: string | null): void;
};
```

## Files

Modify (no new files):
- `/Users/xuhan/code/travel-tw/src/components/map/MapPane.tsx` — subscribe to `selectedId`/`hoveredId`, emit on click/hover, implement pan/zoom effect.
- `/Users/xuhan/code/travel-tw/src/components/map/Pin.tsx` — accept `selected` / `hovered` props; style accordingly.
- `/Users/xuhan/code/travel-tw/src/components/map/Polyline.tsx` — same.
- `/Users/xuhan/code/travel-tw/src/components/editor/TableView.tsx` — click/hover handlers call the store; row highlight reads from it.
- `/Users/xuhan/code/travel-tw/src/components/editor/TimelineView.tsx` — same.
- `/Users/xuhan/code/travel-tw/src/components/map/DaySelector.tsx` — already reads `currentDayId`; ensure symmetry.

## Implementation notes

- **Selection id namespace** — `selectedId` stores a domain id without type prefix; the store derives the type via the current day composition. Alternative (flagged if ambiguity arises): namespace as `event:<id>` / `travel:<id>` / `lodging:<id>`. Start without; switch if we hit collisions.
- **Pan / zoom** — call `map.panTo({lat, lng})` and `map.setZoom(Math.max(15, currentZoom))`. For polylines, use `fitBounds(polylineBounds, { padding: 48 })`. Debounce: if the user clicks two rows rapidly, cancel the in-flight animation (via a ref holding the last selection).
- **Scroll into view** — `ref.scrollIntoView({ block: 'nearest', behavior: 'smooth' })`. TableView rows each hold a ref keyed by id; Timeline blocks likewise.
- **Hover latency** — both sides debounce hover by 50ms to prevent flicker during mouse traversal.
- **Click capture** — the map's background click (non-pin) clears the selection. Use `<Map onClick>` and ignore clicks that have `detail.placeId` or originate from our Marker/Polyline.
- **Selection continuity across day switch** — when `currentDayId` changes, clear `selectedId` and `hoveredId` (the selected entity is likely no longer rendered).
- **Performance** — at N events ~20, no issues expected. Virtualization not needed.

## Verification

1. Click an Event row → Map pans/zooms to that pin; pin gets a glow; row gets an accent.
2. Click a different row → pan transitions; previous pin returns to normal.
3. Click the pin of Event #3 on the Map → right pane scrolls so Event #3 row is visible; row gets accent; map pan is skipped (click originates on map).
4. Hover an Event row → pin gets subtle highlight; no pan.
5. Toggle Table → Timeline → selected Event's block is outlined; toggle back → Table row still accented.
6. Click empty map area → selection clears (rows deaccent); pin glows removed.
7. Switch to another Day → selection clears; Map refits new day's bounds.
8. Click a polyline → selection = that travel id; Map re-fits to the travel's bounds; right pane scrolls to the Travel row (Table) or connector (Timeline).
