import fs from "node:fs";
import path from "node:path";

import { Font } from "@react-pdf/renderer";

const FONTS_DIR = path.join(process.cwd(), "public", "fonts");
const GEIST_REGULAR = path.join(FONTS_DIR, "Geist-Regular.ttf");
const GEIST_BOLD = path.join(FONTS_DIR, "Geist-Bold.ttf");
const GEIST_MONO = path.join(FONTS_DIR, "GeistMono-Regular.ttf");

const geistSansAvailable =
  fs.existsSync(GEIST_REGULAR) && fs.existsSync(GEIST_BOLD);
const geistMonoAvailable = fs.existsSync(GEIST_MONO);

if (geistSansAvailable) {
  Font.register({
    family: "Geist",
    fonts: [
      { src: GEIST_REGULAR, fontWeight: 400 },
      { src: GEIST_BOLD, fontWeight: 700 },
    ],
  });
}

if (geistMonoAvailable) {
  Font.register({
    family: "GeistMono",
    src: GEIST_MONO,
    fontWeight: 400,
  });
}

Font.registerHyphenationCallback((word) => [word]);

export const FONT_SANS = geistSansAvailable ? "Geist" : "Helvetica";
export const FONT_SANS_BOLD = geistSansAvailable
  ? "Geist"
  : "Helvetica-Bold";
export const FONT_MONO = geistMonoAvailable ? "GeistMono" : "Courier";
