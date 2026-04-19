import { and, eq, sql } from "drizzle-orm";
import type { NextRequest } from "next/server";

import { db, schema } from "@/db";
import { computeRoute, NoRouteError } from "@/lib/google/directions";
import { GoogleConfigError, GoogleUpstreamError } from "@/lib/google/places";
import type { DirectionsResult } from "@/lib/google/types";
import { VehicleSchema } from "@/lib/schemas";
import { roundUpToQuarter } from "@/lib/time";

export async function GET(req: NextRequest): Promise<Response> {
  const { searchParams } = req.nextUrl;
  const origin = searchParams.get("origin");
  const dest = searchParams.get("dest");
  const vehicleRaw = searchParams.get("vehicle");

  if (!origin) return Response.json({ error: "origin required" }, { status: 400 });
  if (!dest) return Response.json({ error: "dest required" }, { status: 400 });
  if (!vehicleRaw) {
    return Response.json({ error: "vehicle required" }, { status: 400 });
  }

  const parsed = VehicleSchema.safeParse(vehicleRaw);
  if (!parsed.success) {
    return Response.json({ error: "invalid vehicle" }, { status: 400 });
  }
  const vehicle = parsed.data;

  const [cached] = await db
    .select()
    .from(schema.directionsCache)
    .where(
      and(
        eq(schema.directionsCache.originPlaceId, origin),
        eq(schema.directionsCache.destPlaceId, dest),
        eq(schema.directionsCache.vehicle, vehicle),
      ),
    )
    .limit(1);

  if (cached) {
    console.log(`[directions] cache hit ${origin}->${dest} (${vehicle})`);
    const result: DirectionsResult = {
      travelTime: cached.travelTime,
      routePath: cached.routePath,
      vehicle,
      cached: true,
    };
    return Response.json(result);
  }

  try {
    const { travelTimeMinutes, routePath } = await computeRoute(origin, dest, vehicle);
    const travelTime = roundUpToQuarter(travelTimeMinutes);

    await db
      .insert(schema.directionsCache)
      .values({
        originPlaceId: origin,
        destPlaceId: dest,
        vehicle,
        travelTime,
        routePath,
        fetchedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [
          schema.directionsCache.originPlaceId,
          schema.directionsCache.destPlaceId,
          schema.directionsCache.vehicle,
        ],
        set: {
          travelTime: sql`excluded.travel_time`,
          routePath: sql`excluded.route_path`,
          fetchedAt: sql`excluded.fetched_at`,
        },
      });

    const result: DirectionsResult = {
      travelTime,
      routePath,
      vehicle,
      cached: false,
    };
    return Response.json(result);
  } catch (err) {
    if (err instanceof GoogleConfigError) {
      return Response.json({ error: err.message }, { status: 500 });
    }
    if (err instanceof NoRouteError) {
      return Response.json({ error: "no route" }, { status: 404 });
    }
    if (err instanceof GoogleUpstreamError) {
      return Response.json({ error: "upstream error" }, { status: 502 });
    }
    throw err;
  }
}
