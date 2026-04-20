import { and, eq, sql } from "drizzle-orm";

import { db, schema } from "@/db";
import type { TransitSubtype, Vehicle } from "@/lib/schemas";
import { roundUpToQuarter } from "@/lib/time";

import { GoogleConfigError, GoogleUpstreamError } from "./places";

const ROUTES_URL = "https://routes.googleapis.com/directions/v2:computeRoutes";
const FIELD_MASK = [
  "routes.duration",
  "routes.polyline.encodedPolyline",
  "routes.legs.steps.travelMode",
  "routes.legs.steps.transitDetails.transitLine.vehicle.type",
].join(",");

const VEHICLE_TO_TRAVEL_MODE: Record<Vehicle, string> = {
  walk: "WALK",
  drive: "DRIVE",
  transit: "TRANSIT",
  cycle: "BICYCLE",
};

const RAIL_VEHICLE_TYPES: ReadonlySet<string> = new Set([
  "SUBWAY",
  "METRO_RAIL",
  "HEAVY_RAIL",
  "MONORAIL",
  "LIGHT_RAIL",
  "TRAM",
  "COMMUTER_TRAIN",
  "HIGH_SPEED_TRAIN",
  "LONG_DISTANCE_TRAIN",
  "RAIL",
]);

const BUS_VEHICLE_TYPES: ReadonlySet<string> = new Set([
  "BUS",
  "TROLLEYBUS",
  "INTERCITY_BUS",
  "SHARE_TAXI",
]);

export class NoRouteError extends Error {
  constructor() {
    super("no route");
  }
}

export async function computeRoute(
  origin: string,
  dest: string,
  vehicle: Vehicle,
): Promise<{
  travelTimeMinutes: number;
  routePath: [number, number][];
  transitSubtype: TransitSubtype | null;
}> {
  const base = {
    origin: { placeId: origin },
    destination: { placeId: dest },
    travelMode: VEHICLE_TO_TRAVEL_MODE[vehicle],
  };

  let route: RawRoute | null = null;
  if (vehicle === "transit") {
    route = await fetchRoute({
      ...base,
      transitPreferences: { allowedTravelModes: ["RAIL"] },
    });
  }
  if (!isUsableRoute(route)) {
    route = await fetchRoute(base);
  }
  if (!isUsableRoute(route)) throw new NoRouteError();

  const seconds = Number.parseFloat(route.duration);
  if (!Number.isFinite(seconds)) throw new NoRouteError();

  return {
    travelTimeMinutes: Math.ceil(seconds / 60),
    routePath: decodePolyline(route.polyline.encodedPolyline),
    transitSubtype: vehicle === "transit" ? classifyTransitRoute(route) : null,
  };
}

async function fetchRoute(
  body: Record<string, unknown>,
): Promise<RawRoute | null> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) throw new GoogleConfigError("GOOGLE_MAPS_API_KEY is not set");

  const res = await fetch(ROUTES_URL, {
    method: "POST",
    headers: {
      "X-Goog-Api-Key": key,
      "Content-Type": "application/json",
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("google routes error", res.status, text.slice(0, 400));
    throw new GoogleUpstreamError(res.status);
  }

  const json = (await res.json()) as RawComputeRoutesResponse;
  return json.routes?.[0] ?? null;
}

function isUsableRoute(
  r: RawRoute | null,
): r is RawRoute & {
  duration: string;
  polyline: { encodedPolyline: string };
} {
  return !!r?.duration && !!r.polyline?.encodedPolyline;
}

export async function getOrComputeDirections(
  origin: string,
  dest: string,
  vehicle: Vehicle,
): Promise<{
  travelTime: number;
  routePath: [number, number][];
  transitSubtype: TransitSubtype | null;
  cached: boolean;
}> {
  const [cachedRow] = await db
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

  if (cachedRow) {
    console.log(`[directions] cache hit ${origin}->${dest} (${vehicle})`);
    return {
      travelTime: cachedRow.travelTime,
      routePath: cachedRow.routePath,
      transitSubtype: (cachedRow.transitSubtype as TransitSubtype | null) ?? null,
      cached: true,
    };
  }

  const { travelTimeMinutes, routePath, transitSubtype } = await computeRoute(
    origin,
    dest,
    vehicle,
  );
  const travelTime = roundUpToQuarter(travelTimeMinutes);

  await db
    .insert(schema.directionsCache)
    .values({
      originPlaceId: origin,
      destPlaceId: dest,
      vehicle,
      travelTime,
      transitSubtype,
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
        transitSubtype: sql`excluded.transit_subtype`,
        routePath: sql`excluded.route_path`,
        fetchedAt: sql`excluded.fetched_at`,
      },
    });

  return { travelTime, routePath, transitSubtype, cached: false };
}

function classifyTransitRoute(route: RawRoute): TransitSubtype | null {
  const types = new Set<string>();
  for (const leg of route.legs ?? []) {
    for (const step of leg.steps ?? []) {
      if (step.travelMode !== "TRANSIT") continue;
      const t = step.transitDetails?.transitLine?.vehicle?.type;
      if (t) types.add(t);
    }
  }
  if (types.size === 0) return null;

  let hasRail = false;
  let hasBus = false;
  let hasOther = false;
  for (const t of types) {
    if (RAIL_VEHICLE_TYPES.has(t)) hasRail = true;
    else if (BUS_VEHICLE_TYPES.has(t)) hasBus = true;
    else hasOther = true;
  }
  if (hasOther) return "connected";
  if (hasRail && hasBus) return "connected";
  if (hasRail) return "subway";
  if (hasBus) return "bus";
  return "connected";
}

export function decodePolyline(str: string): [number, number][] {
  const out: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < str.length) {
    let byte = 0;
    let shift = 0;
    let result = 0;
    do {
      byte = str.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    const dLat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dLat;

    shift = 0;
    result = 0;
    do {
      byte = str.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    const dLng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dLng;

    out.push([lat * 1e-5, lng * 1e-5]);
  }

  return out;
}

type RawRoute = {
  duration?: string;
  polyline?: { encodedPolyline?: string };
  legs?: {
    steps?: {
      travelMode?: string;
      transitDetails?: {
        transitLine?: {
          vehicle?: { type?: string };
        };
      };
    }[];
  }[];
};

type RawComputeRoutesResponse = {
  routes?: RawRoute[];
};
