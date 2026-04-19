import type { Vehicle } from "@/lib/schemas";

export type TimelineItem =
  | {
      kind: "lodging";
      id: string;
      time: string;
      label: string | null;
      anchor: "start" | "end";
      top: number;
    }
  | {
      kind: "event";
      id: string;
      top: number;
      height: number;
      startLabel: string;
      endLabel: string;
      placeName: string | null;
    }
  | {
      kind: "travel";
      id: string;
      top: number;
      height: number;
      vehicle: Vehicle | null;
      travelTime: number | null;
      status: "span" | "chip";
    };

export type TimelineUnscheduled =
  | {
      kind: "event";
      id: string;
      placeName: string | null;
      reason: "no-start" | "no-duration";
    }
  | {
      kind: "travel";
      id: string;
      vehicle: Vehicle | null;
      reason: "no-anchor";
    };

export type TimelineModel = {
  dayId: string;
  axisStartMin: number;
  axisEndMin: number;
  pxPerMin: number;
  heightPx: number;
  items: TimelineItem[];
  unscheduled: TimelineUnscheduled[];
};
