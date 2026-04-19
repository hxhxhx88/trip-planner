# 0014 — PDF component tree (react-pdf)

## Context

Product §5.10 specifies a polished PDF brochure: cover, overview, per-day pages with Timeline + static map + detail cards, footer. This sub-plan builds the React-PDF component tree in isolation, runnable offline against fixtures, so it can be iterated independently of the release flow and route handler. `0015` wires the route handler and static-map URL.

## Prerequisites

- `0005` (places, photos pipeline so photo files exist for fixtures).

## Scope

**In:**
- `src/components/pdf/` React-PDF tree:
  - `Cover.tsx` — trip title, date range, day count, summary list of destinations/cities (extracted from lodging/first-of-day Place addresses).
  - `Overview.tsx` — one line per Day: `Day 2 · Tokyo · Asakusa · Tsukiji · Shibuya`.
  - `PerDay.tsx` — Timeline (Event blocks, Travel connectors, blank for gaps) + StaticMap (image) + DetailCards list.
  - `DetailCard.tsx` — photo, name, address, hours, description, remark.
  - `Footer.tsx` — plan name, generation timestamp, `pageNumber / totalPages`, and `N unresolved alerts` summary line if any. Pinned via `<View fixed>` on every non-cover page.
  - `BrochureDocument.tsx` — root `<Document>` composing all pages with consistent typography.
- Shared `styles.ts` (StyleSheet tokens) and `format.ts` helpers (`hoursLine`, `formatTravel`, `formatDateRange`, `formatDayHeader`, `initialsOf`).
- Font registration (`Geist` from local `public/fonts/` with graceful Helvetica/Courier fallback if TTFs are absent — see Implementation notes).
- A fixture module `src/components/pdf/fixtures.ts` with a sample 3-day plan.
- A dev script `scripts/pdf-preview.tsx` that renders `BrochureDocument` to `out/preview.pdf` using fixture data — for fast iteration during design. (File uses `.tsx` so `tsx` runner can parse JSX.)

**Out:**
- Route handler / streaming (`0015`).
- Google Static Maps URL builder (`0015` — `PerDay` accepts a `mapImagePath` that is either an HTTPS URL or an absolute filesystem path, so fixtures can test with a local placeholder / `null` before `0015` lands).

## Schema / types

No new tables.

Types (`src/components/pdf/types.ts`):
```ts
import type { TimelineItem, TimelineModel } from "@/components/editor/timeline/types";

export type TimelineItemPdf = TimelineItem;   // editor's TimelineItem is already plain data — alias for doc parity

export type BrochureCard = {
  photoPath: string | null;     // absolute filesystem path or HTTPS URL
  name: string;
  address: string | null;
  hoursLine: string;            // pre-formatted ("Open 09:00–17:00 today (Mon)" | "Closed today" | "Hours unknown")
  description: string | null;
  remark: string | null;
};

export type BrochureDay = {
  date: string;                 // ISO YYYY-MM-DD
  titleSummary: string;
  timeline: TimelineModel;      // full model (axis range + items + pxPerMin) — 0015 populates via toTimelineModel
  mapImagePath: string | null;  // absolute filesystem path or HTTPS URL; null → placeholder
  cards: BrochureCard[];
};

export type BrochureData = {
  plan: { name: string; dateRange: string; dayCount: number; destinations: string[]; tz: string };
  days: BrochureDay[];
  generatedAt: string;          // pre-formatted e.g. "Generated 2026-04-19 14:32 UTC"
  alertSummary: { issues: number; warnings: number };
};
```

The editor's `TimelineItem` / `TimelineModel` from `@/components/editor/timeline/types` are pure data (no refs/handlers). We reuse them directly rather than defining a parallel PDF-specific shape. `BrochureDay.timeline` carries the full `TimelineModel` (not just items) so `PerDay` can draw the hours axis from `axisStartMin` / `heightPx`.

## Files

Create:
- `src/components/pdf/BrochureDocument.tsx`
- `src/components/pdf/Cover.tsx`
- `src/components/pdf/Overview.tsx`
- `src/components/pdf/PerDay.tsx`
- `src/components/pdf/DetailCard.tsx`
- `src/components/pdf/Footer.tsx`
- `src/components/pdf/styles.ts` — shared `StyleSheet.create` tokens (hex literals mirroring `globals.css` OKLCH values + pt sizes).
- `src/components/pdf/fonts.ts` — conditional `Font.register` calls; exports `FONT_SANS`, `FONT_SANS_BOLD`, `FONT_MONO` that resolve to Geist when TTFs are present, else built-in Helvetica/Courier.
- `src/components/pdf/format.ts` — `hoursLine`, `formatTravel`, `formatDateRange`, `formatDayHeader`, `initialsOf`.
- `src/components/pdf/types.ts`
- `src/components/pdf/fixtures.ts`
- `scripts/pdf-preview.tsx` — writes `out/preview.pdf` (JSX = `.tsx`).
- (Optional, for brand-correct typography) `public/fonts/Geist-Regular.ttf`, `Geist-Bold.ttf`, `GeistMono-Regular.ttf` — sourced from the Geist GitHub releases; keep the license file alongside. If absent, the preview renders with Helvetica/Courier fallbacks.

Modify:
- `package.json` — add dep `@react-pdf/renderer`, devDep `tsx`, and script `"pdf:preview": "tsx scripts/pdf-preview.tsx"`.

Already in place (verified during 0014 audit — no change):
- `next.config.ts` already lists `"@react-pdf/renderer"` in `serverExternalPackages`.
- `.gitignore` already contains `/out/`.
- Real photos at `public/places/{googlePlaceId}/0.jpg` for 3 places — the fixture reuses these.

## Implementation notes

- **Page size** — A4, 36pt margins. Per-day pages use `<Page wrap>` so long card lists flow; Cover and Overview are single-page.
- **Typography** — Geist Sans for body (400/700), Geist Mono for time labels. Headings 28/20/18/14/12pt; body 10pt; meta 9pt. When Geist TTFs are absent, `fonts.ts` falls back to built-in `Helvetica` / `Helvetica-Bold` / `Courier` so the preview still renders. Dropping Geist TTFs into `public/fonts/` later is a zero-code upgrade. Note: the Helvetica fallback lacks some Unicode glyphs (e.g. `→` U+2192) — the fixture uses `·` as the separator for portability; real plan data that contains `→` will render correctly once Geist TTFs are in place.
- **Cover composition** — full-bleed dark accent band with trip name + date range + day count; below: time zone meta + bullet list of destinations (derived from lodging city / Place `category` + address part).
- **Overview page** — one `overviewRow` per day: `Day N` label + `titleSummary`. Footer pinned.
- **Timeline rendering** — react-pdf doesn't support SVG-style layering; we draw it as a fixed-height `<View>` with absolute-positioned children. Call `toTimelineModel({ ..., pxPerMin: 0.4 })` to get pt-based coordinates, then render each `TimelineItem` as a `<View style={{ position: "absolute", top, height }}>`. Hour-tick + half-hour-tick logic mirrors `src/components/editor/timeline/HoursAxis.tsx` (ceil axisStartMin/60 → axisEndMin step 60). Event blocks show place name + `startLabel–endLabel`; travel spans render as vertical rules with a centered chip when there's room (height ≥ 14pt); travel chips are small pill rows at their anchor; lodging markers are tiny labels at top/bottom with the boundary time.
- **Map image** — `PerDay` receives `mapImagePath: string | null`. The accepted values are:
  - An HTTPS URL (what `0015` will pass from `staticMap.buildUrl`) — react-pdf fetches the bytes at render time.
  - An absolute filesystem path (useful for a seeded local placeholder in fixtures).
  - `null` → renders a gray placeholder card with "Map unavailable" + explanatory line.
  `MapFrame` detects `http(s)://` vs filesystem and avoids `fs.existsSync` on URLs, so it works in both modes without per-call configuration.
- **DetailCard** — photo 120×80pt left; text block right. Photo slot accepts the same URL-or-path semantics as map; if `photoPath` is `null`, show an initials-in-square placeholder (derived via `initialsOf()` in `format.ts`).
- **Hours line** — pre-formatted by `format.hoursLine(isoDate, place.hours)`. Exceptions take priority: `{ closed: true }` → "Closed today"; `{ open, close }` → "Open HH:MM–HH:MM today". Otherwise look up the weekday (via `Date.UTC(...).getUTCDay()` to dodge TZ skew) → "Open HH:MM–HH:MM today (Mon)". Missing data → "Hours unknown".
- **Alerts** — footer line only: "N unresolved alerts — see editor for detail." (`Footer.tsx` gates on `issues + warnings > 0`.) We deliberately do **not** replicate the in-editor alert list in the PDF (scope; the released HTML page already shows them).
- **Font registration** — `fonts.ts` runs `Font.register` once at module load when the Geist TTFs exist; `BrochureDocument.tsx` has a side-effect `import "@/components/pdf/fonts"` so registration fires before any page renders. TTFs live under `public/fonts/` and are resolved via `path.join(process.cwd(), 'public/fonts/…')`.
- **Preview script** — `scripts/pdf-preview.tsx` uses `renderToFile` from `@react-pdf/renderer`. Run with `pnpm pdf:preview`. File is `.tsx` because it contains JSX (`<BrochureDocument data={fixture} />`); `tsx` parses JSX only for `.tsx` files. Render loop is ~200ms on fixture data.

## Verification

1. `pnpm pdf:preview` → `out/preview.pdf` generated in ~200ms; open it. With Geist TTFs present: every page renders in Geist. Without them: the PDF still renders in Helvetica/Courier.
2. The fixture produces 8 pages (Cover + Overview + 3 per-day pages, each spilling one continuation page for cards).
3. Edit a fixture value (e.g., add a 4th day) → re-run script → new page appears with correct composition.
4. Set `mapImagePath` to a non-existent local path on one day → PerDay renders the gray placeholder instead of failing. Set it to a real HTTPS URL → react-pdf fetches and embeds.
5. Verify text wrapping on a long `description` (~300+ chars) — no overflow off-page; DetailCard `wrap={false}` keeps each card intact on a single page (spilling to the next if needed).
6. Verify `remark` styling distinguishes from description (italic + left accent border).
7. Fixture includes: a Place with `hours: null` → "Hours unknown"; a Place with a `{ closed: true }` exception on the day's date → "Closed today"; an Event with `placeId: null` → "Unplaced event" with initials-in-square placeholder.
8. Footer on every non-cover page shows plan name, generation timestamp, page number, and alert-summary line (when `issues + warnings > 0`).
