import type { NextRequest } from "next/server";

import {
  getOrComputeDirections,
  NoRouteError,
} from "@/lib/google/directions";
import { GoogleConfigError, GoogleUpstreamError } from "@/lib/google/places";
import type { DirectionsResult } from "@/lib/google/types";
import { VehicleSchema } from "@/lib/schemas";

export async function GET(req: NextRequest): Promise<Response> {
  const { searchParams } = req.nextUrl;
  const origin = searchParams.get("origin");
  const dest = searchParams.get("dest");
  const vehicleRaw = searchParams.get("vehicle");

  if (!origin) return Response.json({ error: "origin required" }, { status: 400 });
  if (!dest) return Response.json({ error: "dest required" }, { status: 400 });
  if (!vehicleRaw) {
    return Response.json({ error: "vehicle required" }, { status: 400 });
  }

  const parsed = VehicleSchema.safeParse(vehicleRaw);
  if (!parsed.success) {
    return Response.json({ error: "invalid vehicle" }, { status: 400 });
  }
  const vehicle = parsed.data;

  try {
    const { travelTime, routePath, cached } = await getOrComputeDirections(
      origin,
      dest,
      vehicle,
    );
    const result: DirectionsResult = { travelTime, routePath, vehicle, cached };
    return Response.json(result);
  } catch (err) {
    if (err instanceof GoogleConfigError) {
      return Response.json({ error: err.message }, { status: 500 });
    }
    if (err instanceof NoRouteError) {
      return Response.json({ error: "no route" }, { status: 404 });
    }
    if (err instanceof GoogleUpstreamError) {
      return Response.json({ error: "upstream error" }, { status: 502 });
    }
    throw err;
  }
}
