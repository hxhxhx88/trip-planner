import type { NextRequest } from "next/server";
import { z } from "zod";

import type { Content } from "@google/genai";

import {
  GeminiConfigError,
  STAY_DURATION_MODEL,
  buildStayDurationSystemInstruction,
  getGeminiClient,
} from "@/lib/ai/gemini";

const MessageSchema = z.object({
  role: z.union([z.literal("user"), z.literal("assistant")]),
  text: z.string().min(1),
});

const InputSchema = z.object({
  place: z.object({
    name: z.string().min(1),
    address: z.string().nullable(),
    category: z.string().nullable(),
  }),
  messages: z
    .array(MessageSchema)
    .min(1)
    .refine(
      (ms) => ms[ms.length - 1]?.role === "user",
      "Last message must be from the user",
    ),
});

export async function POST(req: NextRequest): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  const parsed = InputSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "invalid input", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { messages } = parsed.data;

  const contents: Content[] = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.text }],
  }));

  let iterator: AsyncGenerator<{ text?: string }>;
  try {
    const ai = getGeminiClient();
    iterator = await ai.models.generateContentStream({
      model: STAY_DURATION_MODEL,
      contents,
      config: {
        systemInstruction: buildStayDurationSystemInstruction(),
      },
    });
  } catch (err) {
    if (err instanceof GeminiConfigError) {
      console.error("[stay-duration-chat] config error", err.message);
      return Response.json({ error: err.message }, { status: 500 });
    }
    console.error("[stay-duration-chat] upstream error", err);
    return Response.json({ error: "upstream error" }, { status: 502 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { value, done } = await iterator.next();
        if (done) {
          controller.close();
          return;
        }
        const text = value?.text;
        if (text) controller.enqueue(encoder.encode(text));
      } catch (err) {
        console.error("[stay-duration-chat] stream error", err);
        controller.error(err);
      }
    },
    async cancel() {
      await iterator.return?.(undefined);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
