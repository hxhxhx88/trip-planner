import { parseISO } from "date-fns";

import type { PlaceHours } from "@/lib/schemas";

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function weekdayFromIso(isoDate: string): 0 | 1 | 2 | 3 | 4 | 5 | 6 {
  const [y, m, d] = isoDate.split("-").map(Number);
  const utc = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
  return utc.getUTCDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6;
}

export function hoursLine(
  isoDate: string,
  hours: PlaceHours | null | undefined,
): string {
  if (!hours) return "Hours unknown";

  const exception = hours.exceptions?.find((e) => e.date === isoDate);
  if (exception) {
    if (exception.closed) return "Closed today";
    if (exception.open && exception.close) {
      return `Open ${exception.open}–${exception.close} today`;
    }
  }

  const wd = weekdayFromIso(isoDate);
  const weekly = hours.weekly.find((w) => w.weekday === wd);
  if (weekly) {
    return `Open ${weekly.open}–${weekly.close} today (${WEEKDAY_SHORT[wd]})`;
  }
  return "Closed today";
}

export function formatTravel(minutes: number | null | undefined): string {
  if (minutes == null) return "Travel time unknown";
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const r = minutes % 60;
  return r === 0 ? `${h}h` : `${h}h ${r}m`;
}

export function formatDateRange(
  startIso: string,
  endIso: string,
  locale = "en-US",
): string {
  const start = parseISO(startIso);
  const end = parseISO(endIso);
  const sameYear = start.getFullYear() === end.getFullYear();
  const left = start.toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
  const right = end.toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `${left} – ${right}`;
}

export function formatDayHeader(isoDate: string, locale = "en-US"): string {
  return parseISO(isoDate).toLocaleDateString(locale, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function initialsOf(name: string): string {
  const tokens = name
    .split(/\s+/)
    .map((t) => t.replace(/[^A-Za-z0-9]/g, ""))
    .filter((t) => t.length > 0);
  if (tokens.length === 0) return "?";
  if (tokens.length === 1) return tokens[0].slice(0, 2).toUpperCase();
  return (tokens[0][0] + tokens[1][0]).toUpperCase();
}
