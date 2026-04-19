# 0001 — Foundations

## Context

Everything else stacks on this. We need a working DB connection, typed schemas for all domain entities plus Google caches, migrations, Next 16 config tuned for this app, shadcn/ui scaffolding, a base layout, and shared utilities for time and validation. Product §6 (time model) and §§2, 5.2–5.5 (entities) drive the schema; the decisions table in `implementation.md` drives the stack.

## Prerequisites

None.

## Scope

**In:**
- Postgres connection via Drizzle, pooled, with a typed client at `src/db/index.ts`.
- Drizzle schema for all tables in `implementation.md` §4.
- `drizzle-kit` config + migration workflow + `pnpm db:generate` / `pnpm db:migrate` scripts.
- `next.config.ts` updated: `cacheComponents: true`, `serverExternalPackages: ['@react-pdf/renderer', 'pg']`, `images.remotePatterns` for Google Place photos (we only embed our own local copies so actually the entry is only needed for temporary fetch-and-save — safe to add anyway).
- shadcn/ui init — `components.json` (style `base-nova`, baseColor `neutral`, Base UI primitives), OKLCH tokens in `globals.css`, install `button`, `input`, `label`, `dialog`, `popover`, `select`, `sonner`, `tabs`, `separator`, `tooltip`.
- Base `layout.tsx` rewrite: font, theme tokens, global `<TooltipProvider>` wrap, global `<Toaster />` (from sonner — uses `next-themes` for dark mode).
- Global `not-found.tsx` and `error.tsx`.
- `src/lib/time.ts`: 15-min rounding (`roundToQuarter`, `roundUpToQuarter`), TZ format helpers (`toPlanTz`, `fromPlanTz`), `hhmmToMinutes` / `minutesToHhmm`, plus `normalizeTime` / `denormalizeTime` to bridge HH:MM ↔ Postgres `time` HH:MM:SS at action boundaries.
- `src/lib/slug.ts`: nanoid wrapper with 16-char url-safe alphabet.
- Shared Zod schemas in `src/lib/schemas.ts` for entities we'll reuse across actions (Plan, Day, Event, Travel, Vehicle enum, Alert shape).

**Out (pushed to later):**
- Any route or component (beyond layout shell). Pages in the app directory stay as scaffold until `0003` rewrites them.
- Google API clients — they arrive in `0002`.
- `lib/cascade.ts`, `lib/validate.ts` — stubs only if referenced; implementations in `0010`/`0011`.

## Schema / types

### Drizzle (`src/db/schema.ts`)

```ts
import { pgTable, text, date, time, integer, jsonb, timestamp, primaryKey, real } from 'drizzle-orm/pg-core';

export const plans = pgTable('plans', {
  id: text('id').primaryKey(),            // nanoid
  name: text('name').notNull(),
  timezone: text('timezone').notNull(),
  releasedSlug: text('released_slug').unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const days = pgTable('days', {
  id: text('id').primaryKey(),
  planId: text('plan_id').notNull().references(() => plans.id, { onDelete: 'cascade' }),
  date: date('date').notNull(),
  startLodgingPlaceId: text('start_lodging_place_id').references(() => places.googlePlaceId),
  endLodgingPlaceId: text('end_lodging_place_id').references(() => places.googlePlaceId),
  position: integer('position').notNull(),
});

export const events = pgTable('events', {
  id: text('id').primaryKey(),
  dayId: text('day_id').notNull().references(() => days.id, { onDelete: 'cascade' }),
  position: integer('position').notNull(),
  placeId: text('place_id').references(() => places.googlePlaceId),
  startTime: time('start_time'),                    // HH:MM in plan TZ
  stayDuration: integer('stay_duration'),           // minutes
  description: text('description'),
  remark: text('remark'),
  lockedFields: jsonb('locked_fields').$type<string[]>().default([]).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const travels = pgTable('travels', {
  id: text('id').primaryKey(),
  dayId: text('day_id').notNull().references(() => days.id, { onDelete: 'cascade' }),
  position: integer('position').notNull(),          // sits between events with adjacent positions
  vehicle: text('vehicle'),                         // 'walk' | 'drive' | 'transit' | 'cycle'
  travelTime: integer('travel_time'),               // minutes, rounded up to 15
  routePath: jsonb('route_path').$type<[number, number][]>(),  // polyline as [lat, lng][]
  lockedFields: jsonb('locked_fields').$type<string[]>().default([]).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const places = pgTable('places', {
  googlePlaceId: text('google_place_id').primaryKey(),
  name: text('name').notNull(),
  address: text('address'),
  lat: real('lat'),
  lng: real('lng'),
  photos: jsonb('photos').$type<{ ref: string; width: number; height: number }[]>().default([]).notNull(),
  hours: jsonb('hours').$type<PlaceHours | null>(),
  category: text('category'),
  fetchedAt: timestamp('fetched_at', { withTimezone: true }).defaultNow().notNull(),
});

export const planPlaceOverrides = pgTable('plan_place_overrides', {
  planId: text('plan_id').notNull().references(() => plans.id, { onDelete: 'cascade' }),
  placeId: text('place_id').notNull().references(() => places.googlePlaceId),
  hours: jsonb('hours').$type<PlaceHours>().notNull(),
}, (t) => [primaryKey({ columns: [t.planId, t.placeId] })]);

export const placesCache = pgTable('places_cache', {
  googlePlaceId: text('google_place_id').primaryKey(),
  rawResponse: jsonb('raw_response').notNull(),
  fetchedAt: timestamp('fetched_at', { withTimezone: true }).defaultNow().notNull(),
});

export const directionsCache = pgTable('directions_cache', {
  originPlaceId: text('origin_place_id').notNull(),
  destPlaceId: text('dest_place_id').notNull(),
  vehicle: text('vehicle').notNull(),
  travelTime: integer('travel_time').notNull(),
  routePath: jsonb('route_path').$type<[number, number][]>().notNull(),
  fetchedAt: timestamp('fetched_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [primaryKey({ columns: [t.originPlaceId, t.destPlaceId, t.vehicle] })]);
```

`PlaceHours` type (in `src/lib/schemas.ts`):
```ts
export type PlaceHours = {
  weekly: Array<{ weekday: 0|1|2|3|4|5|6; open: string; close: string }>; // weekday 0=Sun…6=Sat (Google-native); open/close HH:MM in plan timezone
  exceptions?: Array<{ date: string; open?: string; close?: string; closed?: boolean }>;
};
```

### Zod schemas (`src/lib/schemas.ts`)

- `VehicleSchema = z.enum(['walk','drive','transit','cycle'])`
- `TimeHHMMSchema = z.string().regex(/^([01]\d|2[0-3]):([03]0|[14]5|00)$/)` — 15-min granularity enforced at type level.
- `AlertSchema`:
  ```ts
  z.object({
    severity: z.enum(['issue', 'warning']),
    code: z.string(),
    entity: z.object({ type: z.enum(['plan','day','event','travel']), id: z.string() }),
    message: z.string(),
  })
  ```
- Input schemas for each action live in that action's file (e.g. `src/actions/events.ts`), re-using these primitives.

## Files

Create:
- `drizzle.config.ts`
- `.env.example` — `DATABASE_URL=postgres://localhost/travel_tw`, `GOOGLE_MAPS_API_KEY=`, `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID=`
- `src/db/index.ts`
- `src/db/schema.ts`
- `src/lib/time.ts`
- `src/lib/slug.ts`
- `src/lib/schemas.ts`
- `src/app/not-found.tsx`
- `src/app/error.tsx`
- `components.json` — shadcn config
- `src/lib/utils.ts` — shadcn `cn()` helper

Modify:
- `next.config.ts` — `cacheComponents: true`, `serverExternalPackages`, images patterns.
- `src/app/layout.tsx` — wire up font, Toaster, theme tokens, metadata.
- `src/app/globals.css` — shadcn theme tokens (OKLCH; `base-nova` writes `:root` + `.dark` blocks plus `@theme inline` mapping). Replace the self-referential `--font-sans: var(--font-sans);` shadcn emits with `var(--font-geist-sans)` so the Geist `next/font` variables resolve.
- `src/app/page.tsx` — leave as stub until `0003` rewrites it (noop here).
- `package.json` — scripts: `db:generate`, `db:migrate`, `db:studio`. Dependencies (pinned during install, versions current as of 2026-04-19): `drizzle-orm`, `pg`, `nanoid`, `zod`, `date-fns`, `date-fns-tz`, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`, `sonner`, `next-themes` (transitively required by shadcn's sonner wrapper), `@base-ui/react`, `tw-animate-css`. Dev deps: `drizzle-kit`, `@types/pg`, `shadcn` CLI. The Radix-era `@radix-ui/react-*` packages are NOT installed — shadcn's current default (`base-nova`) targets Base UI.

## Implementation notes

- **Next 16 config** — read `node_modules/next/dist/docs/01-app/03-api-reference/05-config/next-config-js/cacheComponents.md` before flipping the flag. Confirm `serverExternalPackages` spelling (it replaced the old `serverComponentsExternalPackages`).
- **Drizzle client** — single pg `Pool` instance, guarded by `globalThis` for dev HMR. Node runtime only; never import `src/db/index.ts` from a client component.
- **Time helpers** — `roundToQuarter(minutes: number)` returns nearest multiple of 15; `roundUpToQuarter` uses `Math.ceil`. Write them **pure** and in `minutes since midnight` space; keep HH:MM parsing separate.
- **TZ helpers** — `toPlanTz(date: Date, tz: string)`, `fromPlanTz(hhmm: string, date: string, tz: string) → Date` using `date-fns-tz`. Plan stores HH:MM; we never do cross-TZ arithmetic in v1 other than on explicit TZ change (handled in `0003`).
- **shadcn theme** — accept the `base-nova` preset's `neutral` baseColor and OKLCH token set (includes `chart-1..5` and `sidebar-*` tokens we won't use yet — keep them; pruning is noise). Keep dark-mode tokens. Don't customize beyond defaults until a later polish pass.
- **Migrations** — first migration generated from the empty schema → full table set. Commit both the schema and the generated SQL under `src/db/migrations/`. Use `drizzle-kit generate` then `drizzle-kit migrate` against `DATABASE_URL`.
- **Env handling** — no `env.ts` wrapper in v1 (Next 16 exposes `process.env.X` in server code; we're not serving on Edge).
- **`drizzle.config.ts` env loading** — drizzle-kit is a standalone CLI and doesn't auto-load `.env*` files the way Next does. Call `loadEnvConfig(process.cwd())` from `@next/env` at the top of `drizzle.config.ts` so `pnpm db:migrate` / `db:generate` / `db:studio` pick up `.env.local` with the same precedence as `next dev`.
- **Worktree paths** — file paths in this doc (and the rest of `docs/`) read `...` for the canonical project root. When implementing inside a `.claude/worktrees/<branch>/` checkout, translate them to the worktree's mirror of the same path.
- **`next.config.ts` `turbopack.root`** — set `turbopack.root = path.resolve(import.meta.dirname)` so Turbopack doesn't pick the parent repo's lockfile when building inside a worktree (silences the multi-lockfile warning). Harmless in non-worktree usage.
- **Composite primary keys** — Drizzle's table-builder callback now expects an **array** (`(t) => [primaryKey({ columns: [...] })]`); the legacy object form `(t) => ({ pk: ... })` is deprecated.
- **`error.tsx` prop name** — Next 16.2 renamed the recoverable callback to `unstable_retry` (was `reset`); use `unstable_retry()` in the Try-again button.
- **shadcn install flow** — drive it with the CLI, not by hand: `pnpm dlx shadcn@latest init --yes --defaults --force --silent` writes `components.json` + `globals.css` tokens + adds `@base-ui/react`, `tw-animate-css`, `shadcn` deps; then `pnpm shadcn add button input label dialog popover select sonner tabs separator tooltip --yes --overwrite` populates `src/components/ui/*`. Adding `sonner` pulls `next-themes` for dark-mode-aware toasts.

## Verification

1. Install deps (`pnpm install`), run `pnpm db:generate` — a migration file appears under `src/db/migrations/0000_*.sql` with all 8 tables and FK/PK constraints.
2. `pnpm build` succeeds, type-check passes, no Next 16 deprecation warnings, build banner shows "Cache Components enabled".
3. `pnpm lint` is clean.
4. `pnpm dev` boots; `/` returns 200 (scaffold page); `/does-not-exist` returns 404 from `not-found.tsx`. Bring the dev server up, confirm with `curl -sI`, then kill — no need to keep it running.
5. Time-helper sanity (one-shot `node --input-type=module -e '...'` rather than a committed script): `roundUpToQuarter(7) === 15`, `roundToQuarter(23) === 30`, `normalizeTime('09:15') === '09:15:00'`.
6. **Skipped at this milestone** (no DB available locally yet): `pnpm db:migrate` and the `'use cache'` end-to-end smoke. Both require `DATABASE_URL` pointing at a live Postgres — they belong with `0002`'s setup, where the first DB-backed reads land.
