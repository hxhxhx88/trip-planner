import type { PlanForEditor } from "@/lib/model/plan";
import type { Alert } from "@/lib/schemas";

export type ResolvedDay = {
  day: PlanForEditor["days"][number];
  events: PlanForEditor["events"][number][];
  travels: PlanForEditor["travels"][number][];
  places: PlanForEditor["places"];
};

export type EventUpdate = {
  id: string;
  startTime?: string;
  stayDuration?: number;
  description?: string;
};

export type TravelUpdate = {
  id: string;
  travelTime?: number;
  routePath?: [number, number][];
};

export type CascadeResult = {
  events: EventUpdate[];
  travels: TravelUpdate[];
  alerts: Alert[];
};
