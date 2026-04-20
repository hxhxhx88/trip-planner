import fs from "node:fs";
import path from "node:path";

import { Font } from "@react-pdf/renderer";

const FONTS_DIR = path.join(process.cwd(), "public", "fonts");
const GEIST_MONO = path.join(FONTS_DIR, "GeistMono-Regular.ttf");
const geistMonoAvailable = fs.existsSync(GEIST_MONO);

// Noto Sans CJK TC — loaded from jsdelivr so we don't commit ~32MB of
// fonts. `@react-pdf/renderer` fetches the file on first render and caches
// it in the in-process FontStore. We use the FULL CJK OTF (not the
// `fonts.gstatic.com` subset) because the Google Fonts TC subset omits
// codepoints that aren't part of standard Traditional usage — notably the
// Simplified form `湾` (U+6E7E), which users do enter in plan names. The
// full OTF covers both Traditional and Simplified CJK Unified Ideographs.
//
// Italic entries reuse the upright files because Noto Sans TC has no
// italic cut — without them `fontStyle: "italic"` throws at render time.
const NOTO_CJK_BASE =
  "https://cdn.jsdelivr.net/gh/notofonts/noto-cjk@Sans2.004/Sans/OTF/TraditionalChinese";
const NOTO_TC_REGULAR = `${NOTO_CJK_BASE}/NotoSansCJKtc-Regular.otf`;
const NOTO_TC_BOLD = `${NOTO_CJK_BASE}/NotoSansCJKtc-Bold.otf`;

Font.register({
  family: "NotoSansTC",
  fonts: [
    { src: NOTO_TC_REGULAR, fontWeight: 400 },
    { src: NOTO_TC_REGULAR, fontWeight: 400, fontStyle: "italic" },
    { src: NOTO_TC_BOLD, fontWeight: 700 },
    { src: NOTO_TC_BOLD, fontWeight: 700, fontStyle: "italic" },
  ],
});

if (geistMonoAvailable) {
  Font.register({
    family: "GeistMono",
    src: GEIST_MONO,
    fontWeight: 400,
  });
}

// CJK text has no word boundaries, so the default hyphenation treats a run
// of Chinese as one unbreakable word and overflows the line. Split each CJK
// char into its own syllable, but keep non-CJK runs embedded in CJK text
// (e.g. "与 AI 对") bonded to a surrounding CJK char so they don't split.
const CJK_RANGE =
  /[\u3000-\u303F\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF]/;
Font.registerHyphenationCallback((word) => {
  if (!CJK_RANGE.test(word)) return [word];
  const parts: string[] = [];
  let syl = "";
  let inNonCjk = false;
  for (const ch of word) {
    const isCjk = CJK_RANGE.test(ch);
    if (isCjk) {
      if (inNonCjk) {
        syl += ch;
        parts.push(syl);
        syl = "";
        inNonCjk = false;
      } else {
        if (syl) parts.push(syl);
        syl = ch;
      }
    } else {
      syl += ch;
      inNonCjk = true;
    }
  }
  if (syl) parts.push(syl);
  return parts;
});

export const FONT_SANS = "NotoSansTC";
export const FONT_SANS_BOLD = "NotoSansTC";
export const FONT_MONO = geistMonoAvailable ? "GeistMono" : "Courier";
