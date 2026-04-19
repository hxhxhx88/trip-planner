import type { PlanForEditor } from "@/lib/model/plan";

export type DayEvent = PlanForEditor["events"][number];
export type DayTravel = PlanForEditor["travels"][number];
export type DayRef = PlanForEditor["days"][number];

export type DayRow =
  | { kind: "lodging-start"; data: { placeId: string | null } }
  | { kind: "travel"; data: DayTravel }
  | { kind: "event"; data: DayEvent }
  | { kind: "lodging-end"; data: { placeId: string | null } };

export function getDayComposition({
  day,
  events,
  travels,
}: {
  day: DayRef;
  events: DayEvent[];
  travels: DayTravel[];
}): DayRow[] {
  const dayEvents = events.filter((e) => e.dayId === day.id);
  const dayTravels = travels.filter((t) => t.dayId === day.id);

  type MiddleRow =
    | { kind: "event"; data: DayEvent }
    | { kind: "travel"; data: DayTravel };
  const middle: MiddleRow[] = [
    ...dayEvents.map<MiddleRow>((e) => ({ kind: "event", data: e })),
    ...dayTravels.map<MiddleRow>((t) => ({ kind: "travel", data: t })),
  ].sort((a, b) => a.data.position - b.data.position);

  return [
    { kind: "lodging-start", data: { placeId: day.startLodgingPlaceId } },
    ...middle,
    { kind: "lodging-end", data: { placeId: day.endLodgingPlaceId } },
  ];
}
