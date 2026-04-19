# 0015 — PDF route handler & static map URL builder

## Context

Wire the PDF tree from `0014` to a streaming route handler. On request, we resolve the plan, call the Static Maps URL builder for each Day, build the `BrochureData`, render to a PDF stream, and respond with `application/pdf`. Exposed from the editor toolbar and released page.

Product §5.10, §8 Q4 (compact variant deferred).

## Prerequisites

- `0013` (released page) — the download link lives there.
- `0014` (PDF tree) — the renderer is ready.

## Scope

**In:**
- `GET /plans/[planId]/pdf` route handler, streaming `application/pdf`.
- `src/lib/google/staticMap.ts` — adds `buildStaticMapUrlForDay(...)` + `encodePolyline(...)` on top of the existing signed `buildStaticMapUrl` primitive (no network here; URLs are signed with `GOOGLE_MAPS_API_KEY` and include markers + path parameters). Returns a URL that Google will serve an image for.
- `src/lib/pdf/data.ts` — `buildBrochureData(planId)`: composes a resolved plan into `BrochureData`, using cached `getPlanForEditor`-style reads and the static-map URL builder.
- Editor top-bar "Download PDF" button linking to `/plans/[planId]/pdf` (opens in new tab).
- Released-page "Download PDF" button linking to the same route (works regardless of release state because it's plan-scoped).

**Out:**
- PDF generation cache (not v1 — cheap enough to regenerate on demand).
- Server-to-client progress (v1 blocks until the stream starts).

## Schema / types

No new tables. The `BrochureData` shape is the one established in `0014` (see `src/components/pdf/types.ts`). Key fields `buildBrochureData` must populate:

- `days[].timeline: TimelineModel` — build via `toTimelineModel({ day, events, travels, places, pxPerMin: 0.4 })` from `src/lib/model/timeline.ts`.
- `days[].mapImagePath: string | null` — the HTTPS URL returned by `buildStaticMapUrlForDay(...)`. (`PerDay` accepts either a URL or a local path; pass URLs here. `buildStaticMapUrlForDay` always returns a string or throws, so in practice this is never `null` from the live path.)
- `days[].cards[].photoPath: string | null` — `path.join(process.cwd(), 'public/places/', googlePlaceId, '0.jpg')` when the place has a photo and the file exists; else `null`.
- `days[].cards[].hoursLine` — call `hoursLine(day.date, place.hours)` from `@/components/pdf/format`.
- `generatedAt` — pre-formatted (e.g. `"Generated 2026-04-19 14:32 UTC"`).
- `alertSummary` — derived by filtering the plan's `Alert[]` on `severity`.

Types (`src/lib/pdf/data.ts`):
```ts
export async function buildBrochureData(planId: string): Promise<BrochureData | null>;
```
Returns `null` when the plan is not found so the route handler can emit a 404.

## Files

Create:
- `src/app/plans/[planId]/pdf/route.tsx` (`.tsx` because the handler renders JSX)
- `src/lib/pdf/data.ts`

Modify:
- `src/lib/google/staticMap.ts` — add `buildStaticMapUrlForDay({ day, events, travels, places })` (day-level composition) and `encodePolyline(points)` (standard Google polyline algorithm); extend `StaticMapPath` with an optional `encoded?: string` so the primitive `buildStaticMapUrl` emits `enc:${encoded}` in place of raw `lat,lng` pairs. The primitive `buildStaticMapUrl` was already implemented in `0002` and is unchanged in shape.
- `src/app/plans/[planId]/edit/layout.tsx` — add Download PDF button/link to the Topbar (server component), alongside `AutoFillButton` and `ReleaseBanner`. Links to `/plans/[planId]/pdf` (`target="_blank"`).
- `src/components/released/ReleasedView.tsx` — add "Download PDF" link to the `<header>` block (between the plan-name title and the day sections). Links to `/plans/[planId]/pdf` with `target="_blank"`. The `planId` is already available as `data.plan.id`.

Not needed (verified during 0014 audit):
- `next.config.ts` already has `"@react-pdf/renderer"` in `serverExternalPackages` (from `0001`) — no change.

## Implementation notes

- **Runtime** — route handler runs on Node (Next 16 default). `@react-pdf/renderer` requires Node APIs; do not set `runtime = 'edge'`.
- **Streaming** — use `renderToStream` from `@react-pdf/renderer`. The whole body is wrapped in a try/catch so plan-not-found emits 404 and any render throw emits a generic 500:
  ```tsx
  import { renderToStream } from '@react-pdf/renderer';
  import { BrochureDocument } from '@/components/pdf/BrochureDocument';
  import { buildBrochureData } from '@/lib/pdf/data';

  export async function GET(_req: Request, ctx: { params: Promise<{ planId: string }> }) {
    const { planId } = await ctx.params;
    try {
      const data = await buildBrochureData(planId);
      if (!data) return new Response('Plan not found', { status: 404 });
      const stream = await renderToStream(<BrochureDocument data={data} />);
      const filename = buildFilename(
        data.plan.name,
        data.days[0]?.date ?? null,
        data.days.at(-1)?.date ?? null,
      );
      return new Response(stream as unknown as ReadableStream, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    } catch (err) {
      console.error('[pdf-route] failed', { planId, err });
      return new Response('Failed to render PDF', { status: 500 });
    }
  }
  ```
  `buildFilename(name, firstDate, lastDate)` is an inline helper: slugifies the plan name (`[^a-z0-9]+` → `-`, trim `-`, fallback `"plan"`), then appends `-{firstDate}-{lastDate}` (or just `-{firstDate}` when single-day, or just `{slug}` for empty-days plans).
- **`buildBrochureData`** — reads the plan via `getPlanForEditor(planId)` and `getAlertsForPlan(planId)` (both cached, both carry `plan:${planId}`, so edits invalidate automatically). Composes `destinations` list (ordered de-dup across lodging + event places), formats dates via `formatDateRange`, builds per-day timeline via `toTimelineModel({ ..., pxPerMin: 0.4 })`, resolves `photoPath` via `fs.existsSync` on `public/places/{placeId}/0.jpg`, and calls `buildStaticMapUrlForDay(...)` per day. Derives `alertSummary` from counting `severity`.
- **Static map URL** — `buildStaticMapUrlForDay` encodes:
  - `center` auto-fit via Google's auto-centering when `markers` are specified.
  - Markers per Event in visit-order using single-char labels — `1…9` then `A…Z` (up to 35 per day, with overflow dropped from the map).
  - Lodging markers (start and end when distinct) with `color:purple|label:H|lat,lng`.
  - Path (polyline) per Travel with color by vehicle (`&path=color:<hex>|weight:4|enc:<encoded>`). `routePath` is encoded via the standard Google polyline algorithm (`encodePolyline`).
  - Vehicle → color (hex `0x…`): `walk 0x22c55e`, `drive 0x2563eb`, `transit 0xdc2626`, `cycle 0xf59e0b`, default `0x64748b`.
  - Signed with the server `GOOGLE_MAPS_API_KEY`.
  - Size `800x480` at `scale=2` for high-DPI.
- **Static map size** — post-build length check: if the URL exceeds 7900 chars (conservative under Google's ~8KB limit), `buildStaticMapUrlForDay` throws with a descriptive message including the day id. Douglas-Peucker simplification remains a deferred follow-up.
- **Filename** — `{slug}-{firstDate}-{lastDate}.pdf`. Slug is plan name lowercased, `[^a-z0-9]+` → `-`, trimmed of `-`, fallback `"plan"`. Single-day plan collapses to `{slug}-{date}.pdf`; empty-days plan to `{slug}.pdf`.
- **Caching** — no `'use cache'` on the route handler. The underlying plan read IS cached; generation is cheap. If generation becomes slow (5+ seconds on large plans), revisit.
- **Error handling** — plan not found → 404 (`Plan not found`). Any throw from `buildBrochureData` (including the static-map-URL-too-long case) or `renderToStream` is caught by the outer try/catch: the full error is logged server-side (`[pdf-route] failed`) and the client gets a generic 500 (`Failed to render PDF`).
- **Fonts bundling** — `0014`'s `src/components/pdf/fonts.ts` already resolves TTFs via `path.join(process.cwd(), 'public/fonts/…')`. For a production brand-correct build, place `Geist-Regular.ttf`, `Geist-Bold.ttf`, and `GeistMono-Regular.ttf` under `public/fonts/` before shipping; otherwise the route still streams a valid PDF using the Helvetica/Courier fallback built into `0014`. Next bundles `public/` automatically — no extra config.

## Verification

1. In the editor, click Download PDF → new tab → browser downloads `Tokyo-Trip-2026-04-19.pdf`. Open it: covers look right; each day has a timeline, a map image with pins and a route, and detail cards with photos.
2. On the released page, tap Download PDF → same file downloads on mobile.
3. Open DevTools Network → the `.pdf` request streams (Response headers visible before body complete).
4. Crash test: a plan with zero Events → PDF still renders Cover + Overview + a per-day page with only Lodging.
5. Crash test: a plan where all Events lack `placeId` → static map URL still valid (omits markers/paths); PDF renders with blank map area.
6. Size: 3-day plan with 9 events produces PDF ≈ 1–2 MB (mostly photos).
7. Fonts: with `public/fonts/Geist-*.ttf` in place, body text visibly uses Geist; without them, the PDF still streams and renders in the Helvetica/Courier fallback established by `0014`.
