import { eq, sql } from "drizzle-orm";
import type { NextRequest } from "next/server";

import { db, schema } from "@/db";
import {
  fetchPlaceDetails,
  GoogleConfigError,
  GoogleUpstreamError,
  PlaceNotFoundError,
} from "@/lib/google/places";
import type { PlaceDetails } from "@/lib/google/types";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export async function GET(req: NextRequest): Promise<Response> {
  const placeId = req.nextUrl.searchParams.get("placeId");
  if (!placeId) {
    return Response.json({ error: "placeId required" }, { status: 400 });
  }

  const [existing] = await db
    .select()
    .from(schema.places)
    .where(eq(schema.places.googlePlaceId, placeId))
    .limit(1);

  if (existing && Date.now() - existing.fetchedAt.getTime() < THIRTY_DAYS_MS) {
    console.log(`[places/details] cache hit ${placeId}`);
    return Response.json(rowToDetails(existing));
  }

  try {
    const { details, raw } = await fetchPlaceDetails(placeId);

    // Upsert places: on conflict, preserve name/address/lat/lng (spec: coords/name never re-fetched);
    // refresh photos/hours/category/fetchedAt. plan_place_overrides is intentionally untouched —
    // overrides live in that separate table and are merged read-side in lib/model/plan.ts.
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
        fetchedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: schema.places.googlePlaceId,
        set: {
          photos: sql`excluded.photos`,
          hours: sql`excluded.hours`,
          category: sql`excluded.category`,
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

    return Response.json(details);
  } catch (err) {
    if (err instanceof GoogleConfigError) {
      return Response.json({ error: err.message }, { status: 500 });
    }
    if (err instanceof PlaceNotFoundError) {
      return Response.json({ error: "place not found" }, { status: 404 });
    }
    if (err instanceof GoogleUpstreamError) {
      return Response.json({ error: "upstream error" }, { status: 502 });
    }
    throw err;
  }
}

function rowToDetails(row: typeof schema.places.$inferSelect): PlaceDetails {
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
