import type { Vehicle } from "@/lib/schemas";
import { VEHICLES } from "@/lib/schemas";
import type { PlanForEditor } from "@/lib/model/plan";
import type { MapDay, MapPin, MapTravelLine } from "@/components/map/types";

function isVehicle(v: string | null): v is Vehicle {
  return v !== null && (VEHICLES as readonly string[]).includes(v);
}

function pinFromPlace(
  id: string,
  placeId: string | null,
  places: PlanForEditor["places"],
): MapPin | null {
  if (!placeId) return null;
  const place = places[placeId];
  if (!place || place.lat === null || place.lng === null) return null;
  return { id, lat: place.lat, lng: place.lng, name: place.name };
}

export function toMapDay(
  data: PlanForEditor,
  dayId: string | null,
): MapDay | null {
  if (!dayId) return null;
  const day = data.days.find((d) => d.id === dayId);
  if (!day) return null;

  const startLodging = pinFromPlace(
    `lodging-start:${day.id}`,
    day.startLodgingPlaceId,
    data.places,
  );
  const rawEndLodging = pinFromPlace(
    `lodging-end:${day.id}`,
    day.endLodgingPlaceId,
    data.places,
  );
  const endLodging =
    rawEndLodging &&
    day.endLodgingPlaceId !== null &&
    day.endLodgingPlaceId === day.startLodgingPlaceId
      ? null
      : rawEndLodging;

  const dayEvents = data.events
    .filter((e) => e.dayId === day.id)
    .slice()
    .sort((a, b) => a.position - b.position);

  const events = dayEvents
    .map((e) => {
      const pin = pinFromPlace(e.id, e.placeId, data.places);
      return pin ? { ...pin, name: pin.name } : null;
    })
    .filter((p): p is MapPin => p !== null)
    .map((p, idx) => ({ ...p, visitNumber: idx + 1 }));

  const travels: MapTravelLine[] = data.travels
    .filter((t) => t.dayId === day.id)
    .filter((t) => t.routePath !== null && t.routePath.length >= 2)
    .map((t) => ({
      id: t.id,
      vehicle: isVehicle(t.vehicle) ? t.vehicle : null,
      routePath: t.routePath as [number, number][],
    }));

  return { dayId: day.id, startLodging, endLodging, events, travels };
}
