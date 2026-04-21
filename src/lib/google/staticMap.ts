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

const SIMPLIFICATION_LADDER = [
  1e-5, 2e-5, 5e-5, 1e-4, 2e-4, 5e-4, 1e-3, 2e-3, 5e-3, 1e-2,
];

export function buildStaticMapUrlForDay({
  day,
  events,
  travels,
  places,
  size = { width: 800, height: 480 },
}: {
  day: PlanForEditor["days"][number];
  events: PlanForEditor["events"];
  travels: PlanForEditor["travels"];
  places: PlanForEditor["places"];
  size?: { width: number; height: number };
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

  const rawPaths: { points: [number, number][]; color: string }[] = [];
  for (const t of travels) {
    if (!t.routePath || t.routePath.length < 2) continue;
    const color = t.vehicle
      ? (VEHICLE_PATH_COLOR[t.vehicle] ?? DEFAULT_PATH_COLOR)
      : DEFAULT_PATH_COLOR;
    rawPaths.push({ points: t.routePath, color });
  }

  const buildWith = (epsilon: number): string => {
    const paths: StaticMapPath[] = [];
    for (const rp of rawPaths) {
      const pts = epsilon > 0 ? simplifyPath(rp.points, epsilon) : rp.points;
      if (pts.length < 2) continue;
      paths.push({ encoded: encodePolyline(pts), color: rp.color, weight: 4 });
    }
    return buildStaticMapUrl({ size, scale: 2, markers, paths });
  };

  let url = buildWith(0);
  if (url.length <= STATIC_MAP_URL_LIMIT) return url;

  for (const epsilon of SIMPLIFICATION_LADDER) {
    url = buildWith(epsilon);
    if (url.length <= STATIC_MAP_URL_LIMIT) {
      console.info(
        `[staticMap] simplified day ${day.id} to ${url.length} chars at epsilon ${epsilon}`,
      );
      return url;
    }
  }

  throw new Error(
    `Static map URL still exceeds safe length (${url.length} chars) for day ${day.id} ` +
      `after simplification up to epsilon ${SIMPLIFICATION_LADDER.at(-1)}. ` +
      `Reduce waypoints or split the day.`,
  );
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

function simplifyPath(
  points: [number, number][],
  epsilon: number,
): [number, number][] {
  if (points.length < 3 || epsilon <= 0) return points;
  const keep = new Array<boolean>(points.length).fill(false);
  keep[0] = true;
  keep[points.length - 1] = true;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [s, e] = stack.pop()!;
    if (e <= s + 1) continue;
    let maxD = 0;
    let maxI = -1;
    for (let i = s + 1; i < e; i++) {
      const d = perpDistance(points[i], points[s], points[e]);
      if (d > maxD) {
        maxD = d;
        maxI = i;
      }
    }
    if (maxD > epsilon && maxI >= 0) {
      keep[maxI] = true;
      stack.push([s, maxI], [maxI, e]);
    }
  }
  const out: [number, number][] = [];
  for (let i = 0; i < points.length; i++) {
    if (keep[i]) out.push(points[i]);
  }
  return out;
}

function perpDistance(
  p: [number, number],
  a: [number, number],
  b: [number, number],
): number {
  const [px, py] = p;
  const [ax, ay] = a;
  const [bx, by] = b;
  const dx = bx - ax;
  const dy = by - ay;
  if (dx === 0 && dy === 0) {
    return Math.hypot(px - ax, py - ay);
  }
  return Math.abs(dx * (ay - py) - (ax - px) * dy) / Math.hypot(dx, dy);
}
