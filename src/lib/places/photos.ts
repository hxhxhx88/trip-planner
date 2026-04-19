import { eq } from "drizzle-orm";
import { mkdir, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { db, schema } from "@/db";

const PHOTOS_DIR = path.join(process.cwd(), "public", "places");

export async function ensurePhoto(
  placeId: string,
  idx: number,
): Promise<void> {
  if (!Number.isInteger(idx) || idx < 0) return;

  const placeDir = path.join(PHOTOS_DIR, placeId);
  const finalPath = path.join(placeDir, `${idx}.jpg`);

  if (await fileExists(finalPath)) return;

  try {
    const [place] = await db
      .select({ photos: schema.places.photos })
      .from(schema.places)
      .where(eq(schema.places.googlePlaceId, placeId))
      .limit(1);

    if (!place) return;
    const photo = place.photos[idx];
    if (!photo) return;

    const key = process.env.GOOGLE_MAPS_API_KEY;
    if (!key) {
      console.error("[ensurePhoto] GOOGLE_MAPS_API_KEY missing");
      return;
    }

    const mediaUrl =
      `https://places.googleapis.com/v1/${photo.ref}/media` +
      `?key=${encodeURIComponent(key)}&maxHeightPx=1600`;

    const upstream = await fetch(mediaUrl);
    if (!upstream.ok) {
      console.error(
        "[ensurePhoto] upstream",
        upstream.status,
        (await upstream.text()).slice(0, 200),
      );
      return;
    }

    const buf = Buffer.from(await upstream.arrayBuffer());
    await mkdir(placeDir, { recursive: true });
    const suffix = Math.random().toString(36).slice(2, 10);
    const tmpPath = `${finalPath}.tmp-${suffix}`;
    await writeFile(tmpPath, buf);
    await rename(tmpPath, finalPath);
  } catch (e) {
    console.error("[ensurePhoto] failed", placeId, idx, e);
  }
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}
