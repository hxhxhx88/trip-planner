import path from "node:path";

import {
  formatDateRange,
  hoursLine,
} from "@/components/pdf/format";
import type {
  BrochureCard,
  BrochureData,
  BrochureDay,
} from "@/components/pdf/types";
import { toTimelineModel } from "@/lib/model/timeline";
import type {
  DayEvent,
  DayRef,
  DayTravel,
} from "@/lib/model/day";
import type { PlanForEditor } from "@/lib/model/plan";

const PDF_PX_PER_MIN = 0.4;

const PHOTO_DIR = path.join(process.cwd(), "public", "places");

const photo = (id: string) => path.join(PHOTO_DIR, id, "0.jpg");

const HOTEL_ID = "ChIJ_7yvWoOpQjQRh2PT2UAEdqA";
const PLACE_A = "ChIJfUpAzTqsQjQRwQl6ORhwbV0";
const PLACE_B = "ChIJraeA2rarQjQRPBBjyR3RxKw";
const PLACE_C = "pdf-fixture-place-c";
const PLACE_D = "pdf-fixture-place-d";
const PLACE_E = "pdf-fixture-place-e";
const PLACE_F = "pdf-fixture-place-f";

const places: PlanForEditor["places"] = {
  [HOTEL_ID]: {
    googlePlaceId: HOTEL_ID,
    name: "Park Hyatt Tokyo",
    address: "3-7-1-2 Nishi Shinjuku, Shinjuku City, Tokyo",
    lat: 35.6856,
    lng: 139.6906,
    category: "lodging",
    photos: [{ ref: "x", width: 800, height: 600 }],
    hours: null,
    hoursSource: "google",
  },
  [PLACE_A]: {
    googlePlaceId: PLACE_A,
    name: "Senso-ji Temple",
    address: "2-3-1 Asakusa, Taito City, Tokyo",
    lat: 35.7148,
    lng: 139.7967,
    category: "tourist_attraction",
    photos: [{ ref: "x", width: 800, height: 600 }],
    hours: {
      weekly: [
        { weekday: 0, open: "06:00", close: "17:00" },
        { weekday: 1, open: "06:00", close: "17:00" },
        { weekday: 2, open: "06:00", close: "17:00" },
        { weekday: 3, open: "06:00", close: "17:00" },
        { weekday: 4, open: "06:00", close: "17:00" },
        { weekday: 5, open: "06:00", close: "17:00" },
        { weekday: 6, open: "06:00", close: "17:00" },
      ],
    },
    hoursSource: "google",
  },
  [PLACE_B]: {
    googlePlaceId: PLACE_B,
    name: "Tsukiji Outer Market",
    address: "4 Chome Tsukiji, Chuo City, Tokyo",
    lat: 35.6655,
    lng: 139.7707,
    category: "market",
    photos: [{ ref: "x", width: 800, height: 600 }],
    hours: {
      weekly: [
        { weekday: 1, open: "05:00", close: "14:00" },
        { weekday: 2, open: "05:00", close: "14:00" },
        { weekday: 3, open: "05:00", close: "14:00" },
        { weekday: 4, open: "05:00", close: "14:00" },
        { weekday: 5, open: "05:00", close: "14:00" },
        { weekday: 6, open: "05:00", close: "14:00" },
      ],
    },
    hoursSource: "google",
  },
  [PLACE_C]: {
    googlePlaceId: PLACE_C,
    name: "Shibuya Sky",
    address: "Shibuya Scramble Square, 2-24-12 Shibuya, Shibuya City, Tokyo",
    lat: 35.6585,
    lng: 139.7019,
    category: "observation_deck",
    photos: [],
    hours: null, // exercises "Hours unknown"
    hoursSource: "google",
  },
  [PLACE_D]: {
    googlePlaceId: PLACE_D,
    name: "teamLab Planets",
    address: "6-1-16 Toyosu, Koto City, Tokyo",
    lat: 35.6501,
    lng: 139.7903,
    category: "art_gallery",
    photos: [],
    hours: {
      weekly: [
        { weekday: 1, open: "10:00", close: "20:00" },
        { weekday: 2, open: "10:00", close: "20:00" },
        { weekday: 3, open: "10:00", close: "20:00" },
        { weekday: 4, open: "10:00", close: "20:00" },
        { weekday: 5, open: "10:00", close: "20:00" },
        { weekday: 6, open: "10:00", close: "21:00" },
        { weekday: 0, open: "10:00", close: "21:00" },
      ],
      exceptions: [
        // Day 2 date: closed-today exception exercise
        { date: "2026-04-21", closed: true },
      ],
    },
    hoursSource: "google",
  },
  [PLACE_E]: {
    googlePlaceId: PLACE_E,
    name: "Meiji Shrine",
    address: "1-1 Yoyogikamizonocho, Shibuya City, Tokyo",
    lat: 35.6763,
    lng: 139.6993,
    category: "tourist_attraction",
    photos: [],
    hours: {
      weekly: [
        { weekday: 0, open: "05:00", close: "18:00" },
        { weekday: 1, open: "05:00", close: "18:00" },
        { weekday: 2, open: "05:00", close: "18:00" },
        { weekday: 3, open: "05:00", close: "18:00" },
        { weekday: 4, open: "05:00", close: "18:00" },
        { weekday: 5, open: "05:00", close: "18:00" },
        { weekday: 6, open: "05:00", close: "18:00" },
      ],
    },
    hoursSource: "google",
  },
  [PLACE_F]: {
    googlePlaceId: PLACE_F,
    name: "Narisawa",
    address: "2-6-15 Minami Aoyama, Minato City, Tokyo",
    lat: 35.6656,
    lng: 139.7195,
    category: "restaurant",
    photos: [],
    hours: {
      weekly: [
        { weekday: 2, open: "18:00", close: "23:00" },
        { weekday: 3, open: "18:00", close: "23:00" },
        { weekday: 4, open: "18:00", close: "23:00" },
        { weekday: 5, open: "18:00", close: "23:00" },
        { weekday: 6, open: "18:00", close: "23:00" },
      ],
    },
    hoursSource: "google",
  },
};

const day1Ref: DayRef = {
  id: "day-1",
  date: "2026-04-20",
  position: 0,
  startLodgingPlaceId: HOTEL_ID,
  endLodgingPlaceId: HOTEL_ID,
};
const day2Ref: DayRef = {
  id: "day-2",
  date: "2026-04-21",
  position: 1,
  startLodgingPlaceId: HOTEL_ID,
  endLodgingPlaceId: HOTEL_ID,
};
const day3Ref: DayRef = {
  id: "day-3",
  date: "2026-04-22",
  position: 2,
  startLodgingPlaceId: HOTEL_ID,
  endLodgingPlaceId: HOTEL_ID,
};

const now = new Date();
const stamp = now.toISOString();
const ev = (
  overrides: Partial<DayEvent> & Pick<DayEvent, "id" | "dayId" | "position">,
): DayEvent => ({
  placeId: null,
  startTime: null,
  stayDuration: null,
  description: null,
  remark: null,
  lockedFields: [],
  updatedAt: now,
  ...overrides,
});
const tr = (
  overrides: Partial<DayTravel> & Pick<DayTravel, "id" | "dayId" | "position">,
): DayTravel => ({
  vehicle: null,
  travelTime: null,
  routePath: null,
  lockedFields: [],
  updatedAt: now,
  ...overrides,
});

const day1Events: DayEvent[] = [
  ev({
    id: "e1-a",
    dayId: day1Ref.id,
    position: 10,
    placeId: PLACE_A,
    startTime: "09:00",
    stayDuration: 90,
    description:
      "Wander the approach to Senso-ji through Nakamise-dori. Stop for ningyo-yaki at Kimura-ya near the main gate.",
    remark: "Try the unagi bun on the way back.",
  }),
  ev({
    id: "e1-b",
    dayId: day1Ref.id,
    position: 30,
    placeId: PLACE_B,
    startTime: "11:30",
    stayDuration: 120,
    description:
      "Early lunch: tuna donburi at Yamacho, tamagoyaki skewers on the walk out.",
    remark: null,
  }),
  ev({
    id: "e1-c",
    dayId: day1Ref.id,
    position: 50,
    placeId: PLACE_C,
    startTime: "17:00",
    stayDuration: 90,
    description: "Sunset time-slot booking. Bring a windbreaker; the open-air Sky Stage is exposed.",
    remark: null,
  }),
];
const day1Travels: DayTravel[] = [
  tr({ id: "t1-0", dayId: day1Ref.id, position: 5, vehicle: "walk", travelTime: 15 }),
  tr({ id: "t1-1", dayId: day1Ref.id, position: 20, vehicle: "walk", travelTime: 30 }),
  tr({ id: "t1-2", dayId: day1Ref.id, position: 40, vehicle: "transit", travelTime: 45 }),
  tr({ id: "t1-3", dayId: day1Ref.id, position: 60, vehicle: "transit", travelTime: 30 }),
];

const day2Events: DayEvent[] = [
  ev({
    id: "e2-a",
    dayId: day2Ref.id,
    position: 10,
    placeId: PLACE_D,
    startTime: "10:30",
    stayDuration: 150,
    description:
      "Water-room + moss garden. Entry requires bare feet; quick-dry pants recommended.",
    remark: "Closed exception — swap with teamLab Borderless if needed.",
  }),
  ev({
    id: "e2-b",
    dayId: day2Ref.id,
    position: 30,
    placeId: PLACE_E,
    startTime: "14:30",
    stayDuration: 90,
    description: "Inner garden iris pond is the quiet corner away from the shrine crowds.",
    remark: null,
  }),
  ev({
    id: "e2-c",
    dayId: day2Ref.id,
    position: 50,
    placeId: PLACE_F,
    startTime: "19:00",
    stayDuration: 150,
    description:
      "Tasting menu, twelve courses. Dress code: smart casual. Allergy card sent in advance.",
    remark: "Anniversary dinner — sommelier pairing ordered ahead.",
  }),
];
const day2Travels: DayTravel[] = [
  tr({ id: "t2-0", dayId: day2Ref.id, position: 5, vehicle: "transit", travelTime: 40 }),
  tr({ id: "t2-1", dayId: day2Ref.id, position: 20, vehicle: "transit", travelTime: 60 }),
  tr({ id: "t2-2", dayId: day2Ref.id, position: 40, vehicle: "walk", travelTime: 30 }),
  tr({ id: "t2-3", dayId: day2Ref.id, position: 60, vehicle: "drive", travelTime: 25 }),
];

const day3Events: DayEvent[] = [
  ev({
    id: "e3-a",
    dayId: day3Ref.id,
    position: 10,
    placeId: PLACE_A,
    startTime: "09:30",
    stayDuration: 180,
    description:
      "A second, slower visit to Senso-ji. This time, skip Nakamise-dori and enter via the Nitenmon gate on the east side — the crowds thin dramatically, and the five-story pagoda catches morning light from this angle. Bring the camera; the lantern inside the Hozomon is worth a long exposure. Budget a full hour for the temple itself, then drift south into the alleys behind Asakusa Hanayashiki — the amusement park is closed weekdays, but the surrounding side streets have a handful of tiny unagi and yakisoba counters that locals favor. Aim to be out by lunch.",
    remark: "Cross-check with the morning weather — move earlier if rain is forecast.",
  }),
  ev({
    id: "e3-b",
    dayId: day3Ref.id,
    position: 30,
    placeId: null, // exercises null-photo placeholder + "Unplaced event" name
    startTime: "14:00",
    stayDuration: 90,
    description: "Open slot — fill in a final stop after breakfast decides.",
    remark: null,
  }),
];
const day3Travels: DayTravel[] = [
  tr({ id: "t3-0", dayId: day3Ref.id, position: 5, vehicle: "walk", travelTime: 20 }),
  tr({ id: "t3-1", dayId: day3Ref.id, position: 20, vehicle: "transit", travelTime: 30 }),
  tr({ id: "t3-2", dayId: day3Ref.id, position: 40, vehicle: "transit", travelTime: 30 }),
];

function buildCards(
  dayRef: DayRef,
  events: DayEvent[],
): BrochureCard[] {
  const photoFor = (placeId: string): string | null => {
    const physical = [HOTEL_ID, PLACE_A, PLACE_B].includes(placeId);
    return physical ? photo(placeId) : null;
  };
  return events
    .slice()
    .sort((a, b) => a.position - b.position)
    .map<BrochureCard>((e) => {
      const place = e.placeId ? places[e.placeId] ?? null : null;
      return {
        photoPath: place ? photoFor(place.googlePlaceId) : null,
        name: place?.name ?? "Unplaced event",
        address: place?.address ?? null,
        hoursLine: place ? hoursLine(dayRef.date, place.hours) : "Hours unknown",
        description: e.description,
        remark: e.remark,
      };
    });
}

function buildDay(
  dayRef: DayRef,
  events: DayEvent[],
  travels: DayTravel[],
  titleSummary: string,
): BrochureDay {
  return {
    date: dayRef.date,
    titleSummary,
    timeline: toTimelineModel({
      day: dayRef,
      events,
      travels,
      places,
      pxPerMin: PDF_PX_PER_MIN,
    }),
    mapImagePath: null,
    cards: buildCards(dayRef, events),
  };
}

export const fixture: BrochureData = {
  plan: {
    name: "Tokyo — Three Day Loop",
    dateRange: formatDateRange("2026-04-20", "2026-04-22"),
    dayCount: 3,
    destinations: [
      "Shinjuku (Park Hyatt Tokyo)",
      "Asakusa · Senso-ji",
      "Tsukiji Outer Market",
      "Shibuya Sky",
      "Toyosu (teamLab Planets)",
      "Minami Aoyama (Narisawa)",
    ],
    tz: "Asia/Tokyo",
  },
  days: [
    buildDay(
      day1Ref,
      day1Events,
      day1Travels,
      "Asakusa · Tsukiji · Shibuya Sky",
    ),
    buildDay(
      day2Ref,
      day2Events,
      day2Travels,
      "teamLab Planets · Meiji Shrine · Narisawa",
    ),
    buildDay(
      day3Ref,
      day3Events,
      day3Travels,
      "Senso-ji (encore) · open slot",
    ),
  ],
  generatedAt: `Generated ${stamp.slice(0, 16).replace("T", " ")} UTC`,
  alertSummary: { issues: 1, warnings: 2 },
};
