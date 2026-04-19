import { after, type NextRequest } from "next/server";

import {
  getOrFetchPlaceDetails,
  GoogleConfigError,
  GoogleUpstreamError,
  PlaceNotFoundError,
} from "@/lib/google/places";
import { ensurePhoto } from "@/lib/places/photos";

export async function GET(req: NextRequest): Promise<Response> {
  const placeId = req.nextUrl.searchParams.get("placeId");
  if (!placeId) {
    return Response.json({ error: "placeId required" }, { status: 400 });
  }

  try {
    const details = await getOrFetchPlaceDetails(placeId);
    if (details.photos.length > 0) {
      after(() => ensurePhoto(placeId, 0));
    }
    return Response.json(details);
  } catch (err) {
    if (err instanceof GoogleConfigError) {
      return Response.json({ error: err.message }, { status: 500 });
    }
    if (err instanceof PlaceNotFoundError) {
      return Response.json({ error: "place not found" }, { status: 404 });
    }
    if (err instanceof GoogleUpstreamError) {
      return Response.json({ error: "upstream error" }, { status: 502 });
    }
    throw err;
  }
}
