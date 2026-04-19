# Travel Planner

A personal, single-user travel itinerary planner. The human provides intent — which places to visit, in what order, and when to arrive — and the machine fills in the derivable pieces: travel time between stops, cascading clock times, Google Place metadata, and conflict alerts (closed venues, missing data, overly tight connections). Released plans live at unlisted URLs and can be exported as a polished PDF brochure.

See [`docs/product.md`](docs/product.md) for the full product design, and [`docs/implementation.md`](docs/implementation.md) for the implementation plan and milestone sequence. Implementation history lives in [`docs/0001-foundations.md`](docs/0001-foundations.md) through [`docs/0016-polish-verification.md`](docs/0016-polish-verification.md).

## Stack

Next.js 16 (App Router, Cache Components), React 19, Tailwind 4, TypeScript strict. Postgres via Drizzle. shadcn/ui primitives. `@vis.gl/react-google-maps` for the interactive map and `@react-pdf/renderer` for the brochure export. No auth — this is a single-user tool; host it yourself.

## Setup

**Prerequisites**

- Node 20+ and pnpm
- A Postgres database (local, Neon, Supabase — any connection URL works)
- A Google Maps Platform API key with **Places API**, **Directions API**, **Maps JavaScript API**, and **Maps Static API** enabled

**Install and configure**

```sh
pnpm install
cp .env.example .env   # if present; otherwise create .env with the values below
```

Populate `.env`:

```
DATABASE_URL=postgresql://user:password@localhost:5432/travel_tw
GOOGLE_MAPS_API_KEY=your-server-side-key
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your-client-side-key
NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID=optional-map-style-id
```

Both `GOOGLE_MAPS_API_KEY` and `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` can be the same key if you don't mind exposing it client-side, but the server-side key is used for Places / Directions / Static Maps and the client-side one only for the interactive map — split them if you plan to restrict by HTTP referer.

**Initialize the database**

```sh
pnpm db:generate   # optional: generate migrations from schema.ts
pnpm db:migrate
```

**Run**

```sh
pnpm dev            # http://localhost:3000
pnpm build          # production build — also runs unstable_instant validation
pnpm start
pnpm db:studio      # browse the DB
pnpm pdf:preview    # render a fixture PDF to out/preview.pdf
```

## Usage tour

1. **Create a plan** from `/`. The timezone defaults to the timezone inferred from the first Place you add.
2. **Add a Day** with a date. Each Day inherits the previous Day's Lodging by default — override per day if you're moving hotels.
3. **Pick Places** via Google Places search in the Lodging slot and each Event slot. Photos and business hours are fetched and cached locally.
4. **Add Events** to the Day. Each Event has optional start time, stay duration, description, and remark. Any field can be blank in draft mode.
5. **Pick a vehicle** for each Travel segment between Events.
6. **Click Auto Fill** (or press `A`). The engine fetches missing Place metadata, computes travel times via Google Directions, and cascades clock times forward and backward from anchors. Conflicts appear as Issues / Warnings in the right-rail alert panel.
7. **Toggle Table ↔ Timeline** with the view switch (`T` / `Shift+T`). Click any item to pan the map and highlight its pin; click a pin to scroll the right pane.
8. **Release** the plan. You get an unlisted URL (`/p/[slug]`) that's mobile-first and read-only. Edits to the editor propagate to the released URL live.
9. **Download PDF** from either the editor header or the released page. The PDF is self-contained — static maps rendered as images, no live tiles required.

### Keyboard shortcuts (editor)

| Key | Action |
|---|---|
| `T` | Table view |
| `Shift+T` | Timeline view |
| `A` | Auto Fill |
| `N` | Add Event to the current day |
| `Cmd/Ctrl+Enter` | Commit the active field (blurs and saves) |

Shortcuts are ignored while focus is inside an input — except `Cmd/Ctrl+Enter`, which is the intended way to commit without clicking away.

## Project structure

```
src/
  app/                  # Next.js routes (pages, layouts, loading, error, api)
  actions/              # server actions grouped by entity
  components/           # editor, map, places, released, pdf, alerts, ui (shadcn)
  db/                   # drizzle client + schema + migrations
  lib/
    autofill/           # Auto Fill engine (backfill + cascade)
    google/             # server-side Google API wrappers
    model/              # cached composition reads (plan, day, map, timeline, alerts, released)
    ...                 # time, hooks, validate, schemas, vehicles, slug, plans
  stores/               # Zustand (selection)
docs/                   # product design + subplans 0001 … 0016
scripts/pdf-preview.tsx # render a fixture PDF
```

## Status

v1 is complete. `docs/0016-polish-verification.md` covers the final polish pass and the end-to-end verification walk-through of product §9 scenarios. Deferred for a future release: E2E tests, multi-zone trips, compact-PDF variant, Scenario-3 unanchored-middle alert.
