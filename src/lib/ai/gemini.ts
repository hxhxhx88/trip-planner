import { GoogleGenAI } from "@google/genai";

export class GeminiConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GeminiConfigError";
  }
}

export const STAY_DURATION_MODEL = "gemini-3.1-pro-preview";

let cached: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
  if (cached) return cached;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new GeminiConfigError("GEMINI_API_KEY is not set");
  cached = new GoogleGenAI({ apiKey });
  return cached;
}

export function buildStayDurationSystemInstruction(): string {
  return [
    "You are a travel advisor helping plan an itinerary.",
    "The user is asking how long to spend at a specific place.",
    "Give a specific estimate — one number or a tight range — and 1-2 sentences of reasoning (what there is to see, typical crowds, whether it's worth longer).",
    "Prefer minutes for short visits (e.g. 45 minutes) and hours for half/full-day visits (e.g. 2-3 hours).",
    "Respond in plain text. Do not use markdown syntax — no bold, no bullets, no headers.",
  ].join(" ");
}

export function buildKickoffPrompt(place: {
  name: string;
  address: string | null;
  category: string | null;
}): string {
  const category = place.category ? ` (${place.category})` : "";
  const where = place.address ? ` in ${place.address}` : "";
  return `As a traveler, how long do you recommend spending at ${place.name}${category}${where}?`;
}
