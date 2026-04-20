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

// Accept "10:00", "9:30", "1000", "930", "0930" → "10:00", "09:30", "10:00",
// "09:30", "09:30". Returns null if unparseable or out of range.
export function parseFlexibleHhmm(raw: string): string | null {
  const t = raw.trim();
  let h: number;
  let m: number;
  const colon = /^(\d{1,2}):(\d{2})$/.exec(t);
  const compact = /^(\d{3,4})$/.exec(t);
  if (colon) {
    h = Number(colon[1]);
    m = Number(colon[2]);
  } else if (compact) {
    const s = compact[1].padStart(4, "0");
    h = Number(s.slice(0, 2));
    m = Number(s.slice(2));
  } else {
    return null;
  }
  if (h > 23 || m > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
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

export type EventTimeRow = {
  id: string;
  startTime: string | null;
  dayDate: string;
};

export type RebasedTimePatch = { id: string; startTime: string };

export function rebaseTimesAcrossTz(
  rows: EventTimeRow[],
  oldTz: string,
  newTz: string,
): RebasedTimePatch[] {
  if (oldTz === newTz) return [];
  const out: RebasedTimePatch[] = [];
  for (const row of rows) {
    if (!row.startTime) continue;
    const hhmm = denormalizeTime(row.startTime);
    const instant = fromPlanTz(hhmm, row.dayDate, oldTz);
    const newHhmm = toPlanTz(instant, newTz);
    out.push({ id: row.id, startTime: normalizeTime(newHhmm) });
  }
  return out;
}
