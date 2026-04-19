import { eq } from "drizzle-orm";
import { mkdir, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { NextRequest } from "next/server";

import { db, schema } from "@/db";

const PHOTOS_DIR = path.join(process.cwd(), "public", "places");

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ placeId: string; idx: string }> },
): Promise<Response> {
  const { placeId, idx: idxStr } = await ctx.params;

  const idx = Number.parseInt(idxStr, 10);
  if (!Number.isInteger(idx) || idx < 0) {
    return Response.json({ error: "invalid idx" }, { status: 400 });
  }

  const placeDir = path.join(PHOTOS_DIR, placeId);
  const finalPath = path.join(placeDir, `${idx}.jpg`);
  const publicUrl = `/places/${placeId}/${idx}.jpg`;

  if (await fileExists(finalPath)) {
    return Response.redirect(new URL(publicUrl, req.url), 302);
  }

  const [place] = await db
    .select({ photos: schema.places.photos })
    .from(schema.places)
    .where(eq(schema.places.googlePlaceId, placeId))
    .limit(1);

  if (!place) {
    return Response.json({ error: "place not cached" }, { status: 404 });
  }

  const photo = place.photos[idx];
  if (!photo) {
    return Response.json({ error: "photo index out of range" }, { status: 404 });
  }

  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) {
    return Response.json(
      { error: "GOOGLE_MAPS_API_KEY is not set" },
      { status: 500 },
    );
  }

  const mediaUrl =
    `https://places.googleapis.com/v1/${photo.ref}/media` +
    `?key=${encodeURIComponent(key)}&maxHeightPx=1600`;

  let upstream: Response;
  try {
    upstream = await fetch(mediaUrl);
  } catch (err) {
    console.error("google photo fetch failed", err);
    return Response.json({ error: "upstream error" }, { status: 502 });
  }

  if (!upstream.ok) {
    const body = await upstream.text();
    console.error("google photo upstream", upstream.status, body.slice(0, 200));
    return Response.json({ error: "upstream error" }, { status: 502 });
  }

  const buf = Buffer.from(await upstream.arrayBuffer());

  await mkdir(placeDir, { recursive: true });
  const suffix = Math.random().toString(36).slice(2, 10);
  const tmpPath = `${finalPath}.tmp-${suffix}`;
  await writeFile(tmpPath, buf);
  await rename(tmpPath, finalPath);

  return Response.redirect(new URL(publicUrl, req.url), 302);
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}
