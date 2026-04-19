import type { Vehicle } from "@/lib/schemas";

import { GoogleConfigError, GoogleUpstreamError } from "./places";

const ROUTES_URL = "https://routes.googleapis.com/directions/v2:computeRoutes";
const FIELD_MASK = "routes.duration,routes.polyline.encodedPolyline";

const VEHICLE_TO_TRAVEL_MODE: Record<Vehicle, string> = {
  walk: "WALK",
  drive: "DRIVE",
  transit: "TRANSIT",
  cycle: "BICYCLE",
};

export class NoRouteError extends Error {
  constructor() {
    super("no route");
  }
}

export async function computeRoute(
  origin: string,
  dest: string,
  vehicle: Vehicle,
): Promise<{ travelTimeMinutes: number; routePath: [number, number][] }> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) throw new GoogleConfigError("GOOGLE_MAPS_API_KEY is not set");

  const res = await fetch(ROUTES_URL, {
    method: "POST",
    headers: {
      "X-Goog-Api-Key": key,
      "Content-Type": "application/json",
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify({
      origin: { placeId: origin },
      destination: { placeId: dest },
      travelMode: VEHICLE_TO_TRAVEL_MODE[vehicle],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error("google routes error", res.status, body.slice(0, 400));
    throw new GoogleUpstreamError(res.status);
  }

  const json = (await res.json()) as RawComputeRoutesResponse;
  const route = json.routes?.[0];
  const encoded = route?.polyline?.encodedPolyline;
  if (!route?.duration || !encoded) throw new NoRouteError();

  const seconds = Number.parseFloat(route.duration);
  if (!Number.isFinite(seconds)) throw new NoRouteError();

  return {
    travelTimeMinutes: Math.ceil(seconds / 60),
    routePath: decodePolyline(encoded),
  };
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

type RawComputeRoutesResponse = {
  routes?: {
    duration?: string;
    polyline?: { encodedPolyline?: string };
  }[];
};
