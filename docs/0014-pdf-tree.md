# 0014 — PDF component tree (react-pdf)

## Context

Product §5.10 specifies a polished PDF brochure: cover, overview, per-day pages with Timeline + static map + detail cards, footer. This sub-plan builds the React-PDF component tree in isolation, runnable offline against fixtures, so it can be iterated independently of the release flow and route handler. `0015` wires the route handler and static-map URL.

## Prerequisites

- `0005` (places, photos pipeline so photo files exist for fixtures).

## Scope

**In:**
- `src/components/pdf/` React-PDF tree:
  - `Cover.tsx` — trip title, date range, day count, summary list of destinations/cities (extracted from lodging/first-of-day Place addresses).
  - `Overview.tsx` — one line per Day: `Day 2 · Tokyo · Asakusa → Tsukiji → Shibuya`.
  - `PerDay.tsx` — Timeline (Event blocks, Travel connectors, blank for gaps) + StaticMap (image) + DetailCards list.
  - `DetailCard.tsx` — photo, name, address, hours, description, remark.
  - `Footer.tsx` — generation timestamp; `N unresolved alerts` summary line if any.
  - `BrochureDocument.tsx` — root `<Document>` composing all pages with consistent typography.
- Font registration (`Geist` from local `public/fonts/` or system fallback).
- A fixture module `src/components/pdf/fixtures.ts` with a sample 3-day plan.
- A dev script `scripts/pdf-preview.ts` that renders `BrochureDocument` to `out/preview.pdf` using fixture data — for fast iteration during design.

**Out:**
- Route handler / streaming (`0015`).
- Google Static Maps URL builder (`0015` — the `PerDay` component takes a URL as a prop so we can test with a local placeholder image first).

## Schema / types

No new tables.

Types (`src/components/pdf/types.ts`):
```ts
export type BrochureData = {
  plan: { name: string; dateRange: string; dayCount: number; destinations: string[]; tz: string };
  days: Array<{
    date: string;
    titleSummary: string;
    timelineItems: TimelineItemPdf[];
    mapImageUrl: string;           // filled by route handler in 0015
    cards: Array<{
      photoUrl: string | null;     // local path
      name: string;
      address: string | null;
      hoursLine: string;           // pre-formatted for today
      description: string | null;
      remark: string | null;
    }>;
  }>;
  generatedAt: string;
  alertSummary: { issues: number; warnings: number };
};
```

`TimelineItemPdf` — mirrors the editor Timeline type but uses plain strings (no refs/handlers).

## Files

Create:
- `/Users/xuhan/code/travel-tw/src/components/pdf/BrochureDocument.tsx`
- `/Users/xuhan/code/travel-tw/src/components/pdf/Cover.tsx`
- `/Users/xuhan/code/travel-tw/src/components/pdf/Overview.tsx`
- `/Users/xuhan/code/travel-tw/src/components/pdf/PerDay.tsx`
- `/Users/xuhan/code/travel-tw/src/components/pdf/DetailCard.tsx`
- `/Users/xuhan/code/travel-tw/src/components/pdf/Footer.tsx`
- `/Users/xuhan/code/travel-tw/src/components/pdf/styles.ts` — shared `StyleSheet.create` tokens.
- `/Users/xuhan/code/travel-tw/src/components/pdf/fonts.ts` — font registration; `Font.register` calls.
- `/Users/xuhan/code/travel-tw/src/components/pdf/fixtures.ts`
- `/Users/xuhan/code/travel-tw/src/components/pdf/types.ts`
- `/Users/xuhan/code/travel-tw/public/fonts/Geist-Regular.ttf` + `Geist-Bold.ttf` (sourced from the Geist GitHub — keep licensing file alongside).
- `/Users/xuhan/code/travel-tw/scripts/pdf-preview.ts` — writes `out/preview.pdf`.

Modify:
- `/Users/xuhan/code/travel-tw/.gitignore` — add `/out/`.
- `/Users/xuhan/code/travel-tw/package.json` — add `pnpm pdf:preview` script and `@react-pdf/renderer` dep.

## Implementation notes

- **Page size** — A4 (or Letter — default A4, note on Cover). Margins 36pt.
- **Typography** — Geist Sans for body, Geist Mono for time labels. Headings in 14/18/24pt. Body 10pt.
- **Cover composition** — full-bleed accent band with trip name; below: date range, day count, bullet list of destinations (derived from lodging city/Place `category` + address part).
- **Overview page** — a simple table: Day · Cities · First→Last highlights.
- **Timeline rendering** — because react-pdf doesn't support DOM/SVG layering the same way as web, draw it as a vertical stack of rows with `minHeight` proportional to duration. Use `View` with absolute positioning within a fixed-height container. Label times at top-left of each block.
- **StaticMap image** — `PerDay` receives `mapImageUrl` (HTTPS URL for Google Static Maps). `Image src={mapImageUrl}` — react-pdf fetches the bytes during render. In fixtures, use a placeholder local image.
- **DetailCard** — photo 120×80pt left; text block right. If photo missing, show initials-in-square placeholder.
- **Hours line** — pre-format as "Open 09:00–17:00 today (Mon)". For special-day exceptions, say "Closed today".
- **Alerts** — footer line only: "2 unresolved alerts — see editor for detail." We deliberately do **not** replicate the in-editor alert list in the PDF (scope; the released HTML page already shows them).
- **Font registration** — once at module load in `fonts.ts`; call from `BrochureDocument`. Keep TTFs under `public/fonts/` so they're trivially reachable; register via `Font.register({ family: 'Geist', fonts: [...] })`.
- **Preview script** — uses `renderToFile` from `@react-pdf/renderer`. Run with `pnpm tsx scripts/pdf-preview.ts`. Fast loop: ~1s per render with fixtures.

## Verification

1. `pnpm pdf:preview` → `out/preview.pdf` generated; open it; every page renders without missing fonts or broken images.
2. Edit a fixture value (e.g., add a 4th day) → re-run script → new page appears with correct composition.
3. Pass `mapImageUrl: 'file:///invalid'` → the PerDay page renders a gray placeholder instead of failing.
4. Verify text wrapping on a long `description` (~300 chars) — no overflow off-page.
5. Verify `remark` styling distinguishes from description (italic or accent color).
6. Fixtures include a "no hours" Place → DetailCard shows "Hours unknown".
