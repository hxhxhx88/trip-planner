import { eq, sql } from "drizzle-orm";

import { db, schema } from "@/db";
import type { PlaceHours, WeeklyHours } from "@/lib/schemas";

import type { AutocompleteHit, PlaceDetails } from "./types";

const PLACES_BASE = "https://places.googleapis.com/v1";
const DETAILS_FIELD_MASK =
  "id,displayName,formattedAddress,location,photos,regularOpeningHours,primaryTypeDisplayName";
const PLACE_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export class GoogleConfigError extends Error {}
export class GoogleUpstreamError extends Error {
  constructor(public status: number) {
    super(`google upstream ${status}`);
  }
}
export class PlaceNotFoundError extends Error {
  constructor(public placeId: string) {
    super(`place ${placeId} not found`);
  }
}

function requireKey(): string {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) throw new GoogleConfigError("GOOGLE_MAPS_API_KEY is not set");
  return key;
}

export type AutocompleteOptions = {
  languageCode?: string;
  locationBias?: { lat: number; lng: number; radiusMeters: number };
};

export async function autocomplete(
  q: string,
  sessionToken: string,
  opts: AutocompleteOptions = {},
): Promise<AutocompleteHit[]> {
  const key = requireKey();
  const body: Record<string, unknown> = { input: q, sessionToken };
  if (opts.languageCode) body.languageCode = opts.languageCode;
  if (opts.locationBias) {
    body.locationBias = {
      circle: {
        center: {
          latitude: opts.locationBias.lat,
          longitude: opts.locationBias.lng,
        },
        radius: opts.locationBias.radiusMeters,
      },
    };
  }
  const res = await fetch(`${PLACES_BASE}/places:autocomplete`, {
    method: "POST",
    headers: {
      "X-Goog-Api-Key": key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error("google autocomplete error", res.status, body.slice(0, 400));
    throw new GoogleUpstreamError(res.status);
  }

  const json = (await res.json()) as RawAutocompleteResponse;
  return (json.suggestions ?? [])
    .filter((s): s is Required<Pick<RawSuggestion, "placePrediction">> =>
      Boolean(s.placePrediction?.placeId),
    )
    .map((s) => ({
      placeId: s.placePrediction.placeId,
      primary: s.placePrediction.structuredFormat?.mainText?.text ?? "",
      secondary: s.placePrediction.structuredFormat?.secondaryText?.text ?? "",
    }));
}

export async function fetchPlaceDetails(
  placeId: string,
  opts: { languageCode?: string } = {},
): Promise<{ details: PlaceDetails; raw: unknown }> {
  const key = requireKey();
  const url = new URL(
    `${PLACES_BASE}/places/${encodeURIComponent(placeId)}`,
  );
  if (opts.languageCode) url.searchParams.set("languageCode", opts.languageCode);
  const res = await fetch(url, {
    headers: {
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": DETAILS_FIELD_MASK,
    },
  });

  if (res.status === 404) throw new PlaceNotFoundError(placeId);
  if (!res.ok) {
    const body = await res.text();
    console.error("google place details error", res.status, body.slice(0, 400));
    throw new GoogleUpstreamError(res.status);
  }

  const json = (await res.json()) as RawPlaceDetails;

  const details: PlaceDetails = {
    googlePlaceId: json.id,
    name: json.displayName?.text ?? placeId,
    address: json.formattedAddress ?? null,
    lat: json.location?.latitude ?? 0,
    lng: json.location?.longitude ?? 0,
    photos: (json.photos ?? [])
      .filter((p): p is RawPhoto => Boolean(p.name))
      .map((p) => ({
        ref: p.name,
        width: p.widthPx ?? 0,
        height: p.heightPx ?? 0,
      })),
    hours: mapHours(json.regularOpeningHours),
    category: json.primaryTypeDisplayName?.text ?? null,
  };

  return { details, raw: json };
}

export async function getOrFetchPlaceDetails(
  placeId: string,
  opts: { languageCode?: string } = {},
): Promise<PlaceDetails> {
  const wantedLang = opts.languageCode ?? "en";
  const [existing] = await db
    .select()
    .from(schema.places)
    .where(eq(schema.places.googlePlaceId, placeId))
    .limit(1);

  const fresh =
    existing && Date.now() - existing.fetchedAt.getTime() < PLACE_CACHE_TTL_MS;
  if (existing && fresh && existing.languageCode === wantedLang) {
    console.log(`[places/details] cache hit ${placeId} (${wantedLang})`);
    return rowToDetails(existing);
  }

  const { details, raw } = await fetchPlaceDetails(placeId, opts);

  await db
    .insert(schema.places)
    .values({
      googlePlaceId: details.googlePlaceId,
      name: details.name,
      address: details.address,
      lat: details.lat,
      lng: details.lng,
      photos: details.photos,
      hours: details.hours,
      category: details.category,
      languageCode: wantedLang,
      fetchedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: schema.places.googlePlaceId,
      set: {
        name: sql`excluded.name`,
        address: sql`excluded.address`,
        lat: sql`excluded.lat`,
        lng: sql`excluded.lng`,
        photos: sql`excluded.photos`,
        hours: sql`excluded.hours`,
        category: sql`excluded.category`,
        languageCode: sql`excluded.language_code`,
        fetchedAt: sql`excluded.fetched_at`,
      },
    });

  await db
    .insert(schema.placesCache)
    .values({
      googlePlaceId: details.googlePlaceId,
      rawResponse: raw,
      fetchedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: schema.placesCache.googlePlaceId,
      set: {
        rawResponse: sql`excluded.raw_response`,
        fetchedAt: sql`excluded.fetched_at`,
      },
    });

  return details;
}

export function rowToDetails(
  row: typeof schema.places.$inferSelect,
): PlaceDetails {
  return {
    googlePlaceId: row.googlePlaceId,
    name: row.name,
    address: row.address,
    lat: row.lat ?? 0,
    lng: row.lng ?? 0,
    photos: row.photos,
    hours: row.hours ?? null,
    category: row.category,
  };
}

function mapHours(raw: RawHours | undefined): PlaceHours | null {
  if (!raw?.periods?.length) return null;
  const weekly: WeeklyHours[] = [];
  for (const period of raw.periods) {
    if (!period.open) continue;
    const openDay = period.open.day as WeeklyHours["weekday"];
    const openStr = formatHM(period.open.hour, period.open.minute ?? 0);

    if (!period.close) {
      weekly.push({ weekday: openDay, open: "00:00", close: "23:59" });
      continue;
    }

    const closeDay = period.close.day as WeeklyHours["weekday"];
    const closeStr = formatHM(period.close.hour, period.close.minute ?? 0);

    if (openDay === closeDay) {
      weekly.push({ weekday: openDay, open: openStr, close: closeStr });
    } else {
      weekly.push({ weekday: openDay, open: openStr, close: "23:59" });
      weekly.push({ weekday: closeDay, open: "00:00", close: closeStr });
    }
  }
  return weekly.length ? { weekly } : null;
}

function formatHM(hour: number, minute: number): string {
  if (hour >= 24) return "23:59";
  const h = String(hour).padStart(2, "0");
  const m = String(minute).padStart(2, "0");
  return `${h}:${m}`;
}

type RawAutocompleteResponse = {
  suggestions?: RawSuggestion[];
};

type RawSuggestion = {
  placePrediction?: {
    placeId: string;
    structuredFormat?: {
      mainText?: { text?: string };
      secondaryText?: { text?: string };
    };
  };
  queryPrediction?: unknown;
};

type RawPlaceDetails = {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  photos?: RawPhoto[];
  regularOpeningHours?: RawHours;
  primaryTypeDisplayName?: { text?: string };
};

type RawPhoto = {
  name: string;
  widthPx?: number;
  heightPx?: number;
};

type RawHours = {
  periods?: RawPeriod[];
};

type RawPeriod = {
  open?: { day: number; hour: number; minute?: number };
  close?: { day: number; hour: number; minute?: number };
};
