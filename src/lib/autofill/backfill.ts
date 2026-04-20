import { eq } from "drizzle-orm";

import { db, schema } from "@/db";
import {
  getOrComputeDirections,
  NoRouteError,
} from "@/lib/google/directions";
import {
  getOrFetchPlaceDetails,
  GoogleConfigError,
  GoogleUpstreamError,
  PlaceNotFoundError,
} from "@/lib/google/places";
import { getDayComposition } from "@/lib/model/day";
import type { Vehicle } from "@/lib/schemas";

import type { ResolvedDay } from "./types";

export type RouteFailure = { travelId: string; reason: string };

type DirectionsTask = {
  travelId: string;
  origin: string;
  dest: string;
  vehicle: Vehicle;
};

export async function backfillDay(
  day: ResolvedDay,
  language: string,
): Promise<{ routeFailures: RouteFailure[] }> {
  const placeIds = collectPlaceIds(day);
  const directionsTasks = buildDirectionsTasks(day);

  const placeOpts: { languageCode?: string } = {};
  if (language !== "en") placeOpts.languageCode = language;

  const [, directionResults] = await Promise.all([
    Promise.allSettled(placeIds.map((id) => getOrFetchPlaceDetails(id, placeOpts))),
    Promise.allSettled(
      directionsTasks.map((task) =>
        getOrComputeDirections(task.origin, task.dest, task.vehicle),
      ),
    ),
  ]);

  const routeFailures: RouteFailure[] = [];
  for (let i = 0; i < directionsTasks.length; i++) {
    const task = directionsTasks[i];
    const result = directionResults[i];
    if (result.status === "fulfilled") {
      await db
        .update(schema.travels)
        .set({
          travelTime: result.value.travelTime,
          routePath: result.value.routePath,
          updatedAt: new Date(),
        })
        .where(eq(schema.travels.id, task.travelId));
    } else {
      routeFailures.push({
        travelId: task.travelId,
        reason: describeError(result.reason),
      });
    }
  }

  return { routeFailures };
}

function collectPlaceIds(day: ResolvedDay): string[] {
  const ids = new Set<string>();
  if (day.day.startLodgingPlaceId) ids.add(day.day.startLodgingPlaceId);
  if (day.day.endLodgingPlaceId) ids.add(day.day.endLodgingPlaceId);
  for (const event of day.events) {
    if (event.placeId) ids.add(event.placeId);
  }
  return [...ids];
}

function buildDirectionsTasks(day: ResolvedDay): DirectionsTask[] {
  const tasks: DirectionsTask[] = [];
  const composition = getDayComposition({
    day: day.day,
    events: day.events,
    travels: day.travels,
  });

  for (let i = 0; i < composition.length; i++) {
    const row = composition[i];
    if (row.kind !== "travel") continue;
    if (!row.data.vehicle) continue;
    if (row.data.travelTime != null) continue;

    const origin = stopPlaceId(composition[i - 1]);
    const dest = stopPlaceId(composition[i + 1]);
    if (!origin || !dest) continue;

    tasks.push({
      travelId: row.data.id,
      origin,
      dest,
      vehicle: row.data.vehicle as Vehicle,
    });
  }

  return tasks;
}

function stopPlaceId(
  row:
    | ReturnType<typeof getDayComposition>[number]
    | undefined,
): string | null {
  if (!row) return null;
  if (row.kind === "event") return row.data.placeId;
  if (row.kind === "lodging-start" || row.kind === "lodging-end") {
    return row.data.placeId;
  }
  return null;
}

function describeError(reason: unknown): string {
  if (reason instanceof NoRouteError) return "no route";
  if (reason instanceof PlaceNotFoundError) return "place not found";
  if (reason instanceof GoogleUpstreamError) return "upstream error";
  if (reason instanceof GoogleConfigError) return "config error";
  if (reason instanceof Error) return reason.message;
  return "unknown error";
}
