import type { PlaceHours, WeeklyHours } from "@/lib/schemas";

import type { AutocompleteHit, PlaceDetails } from "./types";

const PLACES_BASE = "https://places.googleapis.com/v1";
const DETAILS_FIELD_MASK =
  "id,displayName,formattedAddress,location,photos,regularOpeningHours,primaryTypeDisplayName";

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

export async function autocomplete(q: string, sessionToken: string): Promise<AutocompleteHit[]> {
  const key = requireKey();
  const res = await fetch(`${PLACES_BASE}/places:autocomplete`, {
    method: "POST",
    headers: {
      "X-Goog-Api-Key": key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ input: q, sessionToken }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error("google autocomplete error", res.status, body.slice(0, 400));
    throw new GoogleUpstreamError(res.status);
  }

  const json = (await res.json()) as RawAutocompleteResponse;
  return (json.suggestions ?? [])
    .filter((s): s is Required<Pick<RawSuggestion, "placeSuggestion">> =>
      Boolean(s.placeSuggestion?.placeId),
    )
    .map((s) => ({
      placeId: s.placeSuggestion.placeId,
      primary: s.placeSuggestion.structuredFormat?.mainText?.text ?? "",
      secondary: s.placeSuggestion.structuredFormat?.secondaryText?.text ?? "",
    }));
}

export async function fetchPlaceDetails(
  placeId: string,
): Promise<{ details: PlaceDetails; raw: unknown }> {
  const key = requireKey();
  const res = await fetch(`${PLACES_BASE}/places/${encodeURIComponent(placeId)}`, {
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
  placeSuggestion?: {
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
