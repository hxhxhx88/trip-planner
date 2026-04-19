const STATIC_MAP_BASE = "https://maps.googleapis.com/maps/api/staticmap";

export type StaticMapMarker = {
  lat: number;
  lng: number;
  label?: string;
  color?: string;
};

export type StaticMapPath = {
  points: [number, number][];
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
    for (const [lat, lng] of path.points) parts.push(`${lat},${lng}`);
    qs.append("path", parts.join("|"));
  }

  qs.set("key", key);
  return `${STATIC_MAP_BASE}?${qs.toString()}`;
}
