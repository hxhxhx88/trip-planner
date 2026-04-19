import type { PlanForEditor } from "@/lib/model/plan";

const STATIC_MAP_BASE = "https://maps.googleapis.com/maps/api/staticmap";
const STATIC_MAP_URL_LIMIT = 7900;

export type StaticMapMarker = {
  lat: number;
  lng: number;
  label?: string;
  color?: string;
};

export type StaticMapPath = {
  points?: [number, number][];
  encoded?: string;
  color?: string;
  weight?: number;
};

export type StaticMapOptions = {
  size: { width: number; height: number };
  scale?: 1 | 2;
  center?: { lat: number; lng: number };
  zoom?: number;
  markers?: StaticMapMarker[];
  paths?: StaticMapPath[];
  mapId?: string;
};

export function buildStaticMapUrl(opts: StaticMapOptions): string {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) throw new Error("GOOGLE_MAPS_API_KEY is not set");

  const qs = new URLSearchParams();
  qs.set("size", `${opts.size.width}x${opts.size.height}`);
  if (opts.scale) qs.set("scale", String(opts.scale));
  if (opts.center) qs.set("center", `${opts.center.lat},${opts.center.lng}`);
  if (opts.zoom != null) qs.set("zoom", String(opts.zoom));
  if (opts.mapId) qs.set("map_id", opts.mapId);

  for (const marker of opts.markers ?? []) {
    const parts: string[] = [];
    if (marker.color) parts.push(`color:${marker.color}`);
    if (marker.label) parts.push(`label:${marker.label}`);
    parts.push(`${marker.lat},${marker.lng}`);
    qs.append("markers", parts.join("|"));
  }

  for (const path of opts.paths ?? []) {
    const parts: string[] = [];
    if (path.color) parts.push(`color:${path.color}`);
    if (path.weight != null) parts.push(`weight:${path.weight}`);
    if (path.encoded) {
      parts.push(`enc:${path.encoded}`);
    } else if (path.points) {
      for (const [lat, lng] of path.points) parts.push(`${lat},${lng}`);
    } else {
      continue;
    }
    qs.append("path", parts.join("|"));
  }

  qs.set("key", key);
  return `${STATIC_MAP_BASE}?${qs.toString()}`;
}

const VEHICLE_PATH_COLOR: Record<string, string> = {
  walk: "0x22c55e",
  drive: "0x2563eb",
  transit: "0xdc2626",
  cycle: "0xf59e0b",
};
const DEFAULT_PATH_COLOR = "0x64748b";
const EVENT_LABELS = "123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function buildStaticMapUrlForDay({
  day,
  events,
  travels,
  places,
}: {
  day: PlanForEditor["days"][number];
  events: PlanForEditor["events"];
  travels: PlanForEditor["travels"];
  places: PlanForEditor["places"];
}): string {
  const markers: StaticMapMarker[] = [];

  const startLodge = day.startLodgingPlaceId
    ? places[day.startLodgingPlaceId]
    : null;
  const endLodge = day.endLodgingPlaceId
    ? places[day.endLodgingPlaceId]
    : null;
  if (startLodge?.lat != null && startLodge.lng != null) {
    markers.push({
      lat: startLodge.lat,
      lng: startLodge.lng,
      label: "H",
      color: "purple",
    });
  }
  if (
    endLodge?.lat != null &&
    endLodge.lng != null &&
    endLodge.googlePlaceId !== startLodge?.googlePlaceId
  ) {
    markers.push({
      lat: endLodge.lat,
      lng: endLodge.lng,
      label: "H",
      color: "purple",
    });
  }

  let idx = 0;
  for (const e of events) {
    if (!e.placeId) continue;
    const place = places[e.placeId];
    if (place?.lat == null || place.lng == null) continue;
    if (idx >= EVENT_LABELS.length) break;
    markers.push({ lat: place.lat, lng: place.lng, label: EVENT_LABELS[idx] });
    idx += 1;
  }

  const paths: StaticMapPath[] = [];
  for (const t of travels) {
    if (!t.routePath || t.routePath.length < 2) continue;
    const color = t.vehicle
      ? (VEHICLE_PATH_COLOR[t.vehicle] ?? DEFAULT_PATH_COLOR)
      : DEFAULT_PATH_COLOR;
    paths.push({
      encoded: encodePolyline(t.routePath),
      color,
      weight: 4,
    });
  }

  const url = buildStaticMapUrl({
    size: { width: 800, height: 480 },
    scale: 2,
    markers,
    paths,
  });
  if (url.length > STATIC_MAP_URL_LIMIT) {
    throw new Error(
      `Static map URL exceeds safe length (${url.length} chars) for day ${day.id}. ` +
        `Simplify routePath or reduce waypoints.`,
    );
  }
  return url;
}

export function encodePolyline(points: [number, number][]): string {
  let prevLat = 0;
  let prevLng = 0;
  let out = "";
  for (const [lat, lng] of points) {
    const iLat = Math.round(lat * 1e5);
    const iLng = Math.round(lng * 1e5);
    out += encodeSigned(iLat - prevLat);
    out += encodeSigned(iLng - prevLng);
    prevLat = iLat;
    prevLng = iLng;
  }
  return out;
}

function encodeSigned(v: number): string {
  let u = v < 0 ? ~(v << 1) : v << 1;
  let out = "";
  while (u >= 0x20) {
    out += String.fromCharCode((0x20 | (u & 0x1f)) + 63);
    u >>>= 5;
  }
  out += String.fromCharCode(u + 63);
  return out;
}
