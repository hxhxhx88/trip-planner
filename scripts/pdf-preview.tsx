import fs from "node:fs";
import path from "node:path";

import { renderToFile } from "@react-pdf/renderer";

import { BrochureDocument } from "@/components/pdf/BrochureDocument";
import { fixture } from "@/components/pdf/fixtures";

async function main() {
  const outDir = path.join(process.cwd(), "out");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "preview.pdf");
  const started = Date.now();
  await renderToFile(<BrochureDocument data={fixture} />, outPath);
  const ms = Date.now() - started;
  console.log(`[pdf-preview] wrote ${outPath} in ${ms}ms`);
}

main().catch((err) => {
  console.error("[pdf-preview] failed:", err);
  process.exit(1);
});
