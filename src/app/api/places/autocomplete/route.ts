import type { NextRequest } from "next/server";

import {
  autocomplete,
  GoogleConfigError,
  GoogleUpstreamError,
  type AutocompleteOptions,
} from "@/lib/google/places";
import { getPlanSearchContext } from "@/lib/model/plans";

const SEARCH_BIAS_RADIUS_M = 50_000;

export async function GET(req: NextRequest): Promise<Response> {
  const { searchParams } = req.nextUrl;
  const q = searchParams.get("q");
  const sessionToken = searchParams.get("sessionToken");
  const planId = searchParams.get("planId");

  if (!q) return Response.json({ error: "q required" }, { status: 400 });
  if (!sessionToken) {
    return Response.json({ error: "sessionToken required" }, { status: 400 });
  }

  const opts: AutocompleteOptions = {};
  if (planId) {
    const ctx = await getPlanSearchContext(planId);
    if (ctx) {
      if (ctx.language && ctx.language !== "en") opts.languageCode = ctx.language;
      if (ctx.bias) {
        opts.locationBias = {
          lat: ctx.bias.lat,
          lng: ctx.bias.lng,
          radiusMeters: SEARCH_BIAS_RADIUS_M,
        };
      }
    }
  }

  try {
    const hits = await autocomplete(q, sessionToken, opts);
    return Response.json(hits);
  } catch (err) {
    if (err instanceof GoogleConfigError) {
      return Response.json({ error: err.message }, { status: 500 });
    }
    if (err instanceof GoogleUpstreamError) {
      return Response.json({ error: "upstream error" }, { status: 502 });
    }
    throw err;
  }
}
