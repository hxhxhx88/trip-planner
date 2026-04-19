import { renderToStream } from "@react-pdf/renderer";

import { BrochureDocument } from "@/components/pdf/BrochureDocument";
import { buildBrochureData } from "@/lib/pdf/data";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ planId: string }> },
): Promise<Response> {
  const { planId } = await ctx.params;
  try {
    const data = await buildBrochureData(planId);
    if (!data) return new Response("Plan not found", { status: 404 });

    const stream = await renderToStream(<BrochureDocument data={data} />);
    const filename = buildFilename(
      data.plan.name,
      data.days[0]?.date ?? null,
      data.days.at(-1)?.date ?? null,
    );
    return new Response(stream as unknown as ReadableStream, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error("[pdf-route] failed", { planId, err });
    return new Response("Failed to render PDF", { status: 500 });
  }
}

function buildFilename(
  name: string,
  firstDate: string | null,
  lastDate: string | null,
): string {
  const slug =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "plan";
  if (!firstDate) return `${slug}.pdf`;
  if (!lastDate || lastDate === firstDate) return `${slug}-${firstDate}.pdf`;
  return `${slug}-${firstDate}-${lastDate}.pdf`;
}
