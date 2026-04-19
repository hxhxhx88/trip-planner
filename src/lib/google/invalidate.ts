import { and, eq } from "drizzle-orm";

import { db, schema } from "@/db";
import type { Vehicle } from "@/lib/schemas";

const EPOCH = new Date(0);

export async function invalidatePlace(placeId: string): Promise<void> {
  await db
    .update(schema.places)
    .set({ fetchedAt: EPOCH })
    .where(eq(schema.places.googlePlaceId, placeId));
  await db
    .delete(schema.placesCache)
    .where(eq(schema.placesCache.googlePlaceId, placeId));
}

export async function invalidateDirection(
  origin: string,
  dest: string,
  vehicle: Vehicle,
): Promise<void> {
  await db
    .delete(schema.directionsCache)
    .where(
      and(
        eq(schema.directionsCache.originPlaceId, origin),
        eq(schema.directionsCache.destPlaceId, dest),
        eq(schema.directionsCache.vehicle, vehicle),
      ),
    );
}

export async function invalidateAll(): Promise<void> {
  await db.update(schema.places).set({ fetchedAt: EPOCH });
  await db.delete(schema.placesCache);
  await db.delete(schema.directionsCache);
}
