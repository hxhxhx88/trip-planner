import { z } from "zod";

export const VEHICLES = ["walk", "drive", "transit", "cycle"] as const;
export type Vehicle = (typeof VEHICLES)[number];
export const VehicleSchema = z.enum(VEHICLES);

export const TimeHHMMSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):(00|15|30|45)$/, "Time must be HH:MM at 15-minute granularity");

export const ENTITY_TYPES = ["plan", "day", "event", "travel"] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

export const ALERT_SEVERITIES = ["issue", "warning"] as const;
export type AlertSeverity = (typeof ALERT_SEVERITIES)[number];

export const ALERT_CODES = [
  "day_missing_lodging",
  "day_missing_end_lodging",
  "day_duplicate_date",
  "event_missing_place",
  "event_outside_hours",
  "event_closes_during",
  "travel_missing_vehicle",
  "travel_tight",
  "travel_long",
  "events_overlap",
  "cascade_unresolved",
  "gap_long",
  "place_hours_unknown",
] as const;
export type AlertCode = (typeof ALERT_CODES)[number];

export const AlertSchema = z.object({
  severity: z.enum(ALERT_SEVERITIES),
  code: z.enum(ALERT_CODES),
  entity: z.object({
    type: z.enum(ENTITY_TYPES),
    id: z.string(),
  }),
  message: z.string(),
  hint: z.string().optional(),
});
export type Alert = z.infer<typeof AlertSchema>;

export type WeeklyHours = {
  weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  open: string;
  close: string;
};

export type HoursException = {
  date: string;
  open?: string;
  close?: string;
  closed?: boolean;
};

export type PlaceHours = {
  weekly: WeeklyHours[];
  exceptions?: HoursException[];
};

export type PlacePhoto = {
  ref: string;
  width: number;
  height: number;
};
