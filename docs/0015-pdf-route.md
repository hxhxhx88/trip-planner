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
- `src/lib/google/staticMap.ts` — URL builder (no network here; URLs are signed with `GOOGLE_MAPS_API_KEY` and include markers + path parameters). Returns a URL that Google will serve an image for.
- `src/lib/pdf/data.ts` — `buildBrochureData(planId)`: composes a resolved plan into `BrochureData`, using cached `getPlanForEditor`-style reads and the static-map URL builder.
- Editor top-bar "Download PDF" button linking to `/plans/[planId]/pdf` (opens in new tab).
- Released-page "Download PDF" button linking to the same route (works regardless of release state because it's plan-scoped).

**Out:**
- PDF generation cache (not v1 — cheap enough to regenerate on demand).
- Server-to-client progress (v1 blocks until the stream starts).

## Schema / types

No new tables. The `BrochureData` shape is the one established in `0014` (see `src/components/pdf/types.ts`). Key fields `buildBrochureData` must populate:

- `days[].timeline: TimelineModel` — build via `toTimelineModel({ day, events, travels, places, pxPerMin: 0.4 })` from `src/lib/model/timeline.ts`.
- `days[].mapImagePath: string | null` — the HTTPS URL returned by `staticMap.buildUrl(...)`. (`PerDay` accepts either a URL or a local path; pass URLs here.)
- `days[].cards[].photoPath: string | null` — `path.join(process.cwd(), 'public/places/', googlePlaceId, '0.jpg')` when the place has a photo and the file exists; else `null`.
- `days[].cards[].hoursLine` — call `hoursLine(day.date, place.hours)` from `@/components/pdf/format`.
- `generatedAt` — pre-formatted (e.g. `"Generated 2026-04-19 14:32 UTC"`).
- `alertSummary` — derived by filtering the plan's `Alert[]` on `severity`.

Types (`src/lib/pdf/data.ts`):
```ts
export async function buildBrochureData(planId: string): Promise<BrochureData>;
```

## Files

Create:
- `src/app/plans/[planId]/pdf/route.ts`
- `src/lib/pdf/data.ts`

Modify:
- `src/lib/google/staticMap.ts` — implement (stub exists from `0002`).
- `src/app/plans/[planId]/edit/layout.tsx` — add Download PDF button/link to the Topbar (server component), alongside `AutoFillButton` and `ReleaseBanner`. Links to `/plans/[planId]/pdf` (`target="_blank"`).
- `src/components/released/ReleasedView.tsx` — add "Download PDF" link to the `<header>` block (between the plan-name title and the day sections). Links to `/plans/[planId]/pdf` with `target="_blank"`. The `planId` is already available as `data.plan.id`.

Not needed (verified during 0014 audit):
- `next.config.ts` already has `"@react-pdf/renderer"` in `serverExternalPackages` (from `0001`) — no change.

## Implementation notes

- **Runtime** — route handler runs on Node (Next 16 default). `@react-pdf/renderer` requires Node APIs; do not set `runtime = 'edge'`.
- **Streaming** — use `renderToStream` from `@react-pdf/renderer`:
  ```ts
  import { renderToStream } from '@react-pdf/renderer';
  import { BrochureDocument } from '@/components/pdf/BrochureDocument';

  export async function GET(req: Request, ctx: { params: Promise<{ planId: string }> }) {
    const { planId } = await ctx.params;
    const data = await buildBrochureData(planId);
    const stream = await renderToStream(<BrochureDocument data={data} />);
    return new Response(stream as unknown as ReadableStream, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${slugifyFilename(data.plan.name)}.pdf"`,
      },
    });
  }
  ```
- **`buildBrochureData`** — reads the plan via the cached model layer (same helpers used by the editor), composes `destinations` list, formats dates, builds timeline items, etc. For each Day, calls `staticMap.buildUrl({ pins, polylines, size: '800x480', scale: 2 })`.
- **Static map URL** — encodes:
  - `center` auto-fit via Google's auto-centering when `markers` are specified.
  - Markers per Event in visit-order, using numbered labels (`&markers=label:1|lat,lng&markers=label:2|lat,lng`).
  - Lodging marker with distinct color (e.g., `color:purple|label:H|lat,lng`).
  - Path (polyline) per Travel with color by vehicle (`&path=color:0x2563eb|weight:4|enc:<encoded>`). Re-encode `routePath` as a Google polyline string on the server.
  - Signed with the server `GOOGLE_MAPS_API_KEY`.
  - Size `800x480` at `scale=2` for high-DPI.
- **Static map size** — stays under Google's URL length limit (~8KB). If a route has huge polylines, simplify with Douglas-Peucker (tolerance ~1e-4 degrees). Leave as a TODO unless tests fail.
- **Filename** — `{plan-name-slug}-{date-range}.pdf`. Strip non-ASCII for safety; keep Unicode for the `Content-Disposition` RFC 5987 form if we want localized names (nice-to-have).
- **Caching** — no `'use cache'` on the route handler. The underlying plan read IS cached; generation is cheap. If generation becomes slow (5+ seconds on large plans), revisit.
- **Error handling** — plan not found → 404; Static Maps URL too long → 500 with message + diagnostic; `renderToStream` throw → 500 with generic message (log full trace).
- **Fonts bundling** — `0014`'s `src/components/pdf/fonts.ts` already resolves TTFs via `path.join(process.cwd(), 'public/fonts/…')`. For a production brand-correct build, place `Geist-Regular.ttf`, `Geist-Bold.ttf`, and `GeistMono-Regular.ttf` under `public/fonts/` before shipping; otherwise the route still streams a valid PDF using the Helvetica/Courier fallback built into `0014`. Next bundles `public/` automatically — no extra config.

## Verification

1. In the editor, click Download PDF → new tab → browser downloads `Tokyo-Trip-2026-04-19.pdf`. Open it: covers look right; each day has a timeline, a map image with pins and a route, and detail cards with photos.
2. On the released page, tap Download PDF → same file downloads on mobile.
3. Open DevTools Network → the `.pdf` request streams (Response headers visible before body complete).
4. Crash test: a plan with zero Events → PDF still renders Cover + Overview + a per-day page with only Lodging.
5. Crash test: a plan where all Events lack `placeId` → static map URL still valid (omits markers/paths); PDF renders with blank map area.
6. Size: 3-day plan with 9 events produces PDF ≈ 1–2 MB (mostly photos).
7. Fonts: with `public/fonts/Geist-*.ttf` in place, body text visibly uses Geist; without them, the PDF still streams and renders in the Helvetica/Courier fallback established by `0014`.
