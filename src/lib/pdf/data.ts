import fs from "node:fs";
import path from "node:path";

import { formatDateRange, hoursLine } from "@/components/pdf/format";
import type {
  BrochureCard,
  BrochureData,
  BrochureDay,
} from "@/components/pdf/types";
import { buildStaticMapUrlForDay } from "@/lib/google/staticMap";
import { getAlertsForPlan } from "@/lib/model/alerts";
import { getPlanForEditor, type PlanForEditor } from "@/lib/model/plan";
import { toTimelineModel } from "@/lib/model/timeline";

const PDF_PX_PER_MIN = 0.6;
const PDF_MAP_SIZE = { width: 640, height: 880 };
const PHOTO_DIR = path.join(process.cwd(), "public", "places");

export async function buildBrochureData(
  planId: string,
): Promise<BrochureData | null> {
  const [plan, alerts] = await Promise.all([
    getPlanForEditor(planId),
    getAlertsForPlan(planId),
  ]);
  if (!plan) return null;

  const days: BrochureDay[] = plan.days.map((dayRef) => {
    const dayEvents = plan.events.filter((e) => e.dayId === dayRef.id);
    const dayTravels = plan.travels.filter((t) => t.dayId === dayRef.id);
    return {
      date: dayRef.date,
      titleSummary: titleSummary(dayEvents, plan.places),
      timeline: toTimelineModel({
        day: dayRef,
        events: dayEvents,
        travels: dayTravels,
        places: plan.places,
        pxPerMin: PDF_PX_PER_MIN,
      }),
      mapImagePath: buildStaticMapUrlForDay({
        day: dayRef,
        events: dayEvents,
        travels: dayTravels,
        places: plan.places,
        size: PDF_MAP_SIZE,
      }),
      cards: buildCards(dayRef, dayEvents, plan.places),
    };
  });

  const firstDate = plan.days[0]?.date ?? null;
  const lastDate = plan.days.at(-1)?.date ?? firstDate;
  const dateRange =
    firstDate && lastDate ? formatDateRange(firstDate, lastDate) : "";

  const nowIso = new Date().toISOString();
  const generatedAt = `Generated ${nowIso.slice(0, 16).replace("T", " ")} UTC`;

  return {
    plan: {
      name: plan.plan.name,
      dateRange,
      dayCount: plan.days.length,
      destinations: buildDestinations(plan),
      tz: plan.plan.timezone,
    },
    days,
    generatedAt,
    alertSummary: {
      issues: alerts.filter((a) => a.severity === "issue").length,
      warnings: alerts.filter((a) => a.severity === "warning").length,
    },
  };
}

function titleSummary(
  events: PlanForEditor["events"],
  places: PlanForEditor["places"],
): string {
  const names = events
    .filter((e) => e.placeId)
    .map((e) => places[e.placeId!]?.name)
    .filter((n): n is string => !!n);
  return names.length > 0 ? names.join(" · ") : "(no events)";
}

function buildDestinations(plan: PlanForEditor): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (name: string | undefined | null) => {
    if (!name || seen.has(name)) return;
    seen.add(name);
    out.push(name);
  };
  for (const day of plan.days) {
    if (day.startLodgingPlaceId) add(plan.places[day.startLodgingPlaceId]?.name);
    for (const e of plan.events.filter((x) => x.dayId === day.id)) {
      if (e.placeId) add(plan.places[e.placeId]?.name);
    }
  }
  return out;
}

function buildCards(
  dayRef: PlanForEditor["days"][number],
  events: PlanForEditor["events"],
  places: PlanForEditor["places"],
): BrochureCard[] {
  return events.map<BrochureCard>((e) => {
    const place = e.placeId ? (places[e.placeId] ?? null) : null;
    const photoPath =
      place && place.photos.length > 0 && hasPhotoOnDisk(place.googlePlaceId)
        ? photoPathFor(place.googlePlaceId)
        : null;
    return {
      photoPath,
      name: place?.name ?? "Unplaced event",
      address: place?.address ?? null,
      hoursLine: place ? hoursLine(dayRef.date, place.hours) : "Hours unknown",
      description: e.description,
      remark: e.remark,
    };
  });
}

function photoPathFor(placeId: string): string {
  return path.join(PHOTO_DIR, placeId, "0.jpg");
}

function hasPhotoOnDisk(placeId: string): boolean {
  return fs.existsSync(photoPathFor(placeId));
}
