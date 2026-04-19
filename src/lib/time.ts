import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

const QUARTER = 15;

export function roundToQuarter(minutes: number): number {
  return Math.round(minutes / QUARTER) * QUARTER;
}

export function roundUpToQuarter(minutes: number): number {
  return Math.ceil(minutes / QUARTER) * QUARTER;
}

export function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function minutesToHhmm(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function normalizeTime(hhmm: string): string {
  return hhmm.length === 5 ? `${hhmm}:00` : hhmm;
}

export function denormalizeTime(pgTime: string): string {
  return pgTime.slice(0, 5);
}

export function toPlanTz(date: Date, timezone: string): string {
  return formatInTimeZone(date, timezone, "HH:mm");
}

export function fromPlanTz(hhmm: string, dateISO: string, timezone: string): Date {
  return fromZonedTime(`${dateISO}T${normalizeTime(hhmm)}`, timezone);
}
