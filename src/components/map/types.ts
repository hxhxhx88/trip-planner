import type { Vehicle } from "@/lib/schemas";

export type MapPin = {
  id: string;
  lat: number;
  lng: number;
  name: string;
};

export type MapEventPin = MapPin & { visitNumber: number };

export type MapTravelLine = {
  id: string;
  vehicle: Vehicle | null;
  routePath: [number, number][];
};

export type MapDay = {
  dayId: string;
  startLodging: MapPin | null;
  endLodging: MapPin | null;
  events: MapEventPin[];
  travels: MapTravelLine[];
};
