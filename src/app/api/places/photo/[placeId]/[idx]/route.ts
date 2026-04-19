import { stat } from "node:fs/promises";
import path from "node:path";
import type { NextRequest } from "next/server";

import { ensurePhoto } from "@/lib/places/photos";

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

  const finalPath = path.join(PHOTOS_DIR, placeId, `${idx}.jpg`);
  const publicUrl = `/places/${placeId}/${idx}.jpg`;

  if (!(await fileExists(finalPath))) {
    await ensurePhoto(placeId, idx);
    if (!(await fileExists(finalPath))) {
      return Response.json({ error: "not available" }, { status: 404 });
    }
  }

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
