import type { PlaceHours, Vehicle } from "@/lib/schemas";

export type AutocompleteHit = {
  placeId: string;
  primary: string;
  secondary: string;
};

export type PlaceDetails = {
  googlePlaceId: string;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  photos: { ref: string; width: number; height: number }[];
  hours: PlaceHours | null;
  category: string | null;
};

export type DirectionsResult = {
  travelTime: number;
  routePath: [number, number][];
  vehicle: Vehicle;
  cached: boolean;
};
