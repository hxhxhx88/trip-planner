import { find } from "geo-tz";

export function inferTimezone(lat: number, lng: number): string | null {
  const zones = find(lat, lng);
  return zones[0] ?? null;
}
