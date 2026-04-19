import { parseISO } from "date-fns";

import { ReleasedDay } from "@/components/released/ReleasedDay";
import type { PlanForEditor } from "@/lib/model/plan";
import type { Alert, AlertCode } from "@/lib/schemas";

type Props = {
  data: PlanForEditor;
  alerts: Alert[];
};

export function ReleasedView({ data, alerts }: Props) {
  const { plan, days, events, travels, places } = data;

  const eventToDay = new Map(events.map((e) => [e.id, e.dayId] as const));
  const travelToDay = new Map(travels.map((t) => [t.id, t.dayId] as const));

  const alertsByDay: Record<string, Alert[]> = {};
  const alertsByEntity: Record<string, Alert[]> = {};
  for (const a of alerts) {
    const dayId = resolveDayId(a, eventToDay, travelToDay);
    if (dayId) {
      (alertsByDay[dayId] ??= []).push(a);
    }
    const entityKey = uiEntityKey(a);
    if (entityKey) {
      (alertsByEntity[entityKey] ??= []).push(a);
    }
  }

  const dateRange = formatDateRange(days);

  return (
    <main className="space-y-6">
      <header className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          {plan.name}
        </h1>
        <p className="text-sm text-muted-foreground">
          {dateRange ? `${dateRange} · ` : ""}
          {plan.timezone}
        </p>
        <a
          href={`/plans/${plan.id}/pdf`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-primary underline-offset-2 hover:underline"
        >
          Download PDF
        </a>
      </header>

      {days.length === 0 ? (
        <p className="rounded-xl border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
          This trip has no days yet.
        </p>
      ) : (
        <div className="space-y-10">
          {days.map((day, i) => (
            <ReleasedDay
              key={day.id}
              index={i}
              day={day}
              events={events.filter((e) => e.dayId === day.id)}
              travels={travels.filter((t) => t.dayId === day.id)}
              places={places}
              dayAlerts={alertsByDay[day.id] ?? []}
              alertsByEntity={alertsByEntity}
              firstDay={i === 0}
            />
          ))}
        </div>
      )}
    </main>
  );
}

function resolveDayId(
  alert: Alert,
  eventToDay: Map<string, string>,
  travelToDay: Map<string, string>,
): string | null {
  if (alert.entity.type === "day") return alert.entity.id;
  if (alert.entity.type === "event")
    return eventToDay.get(alert.entity.id) ?? null;
  if (alert.entity.type === "travel")
    return travelToDay.get(alert.entity.id) ?? null;
  return null;
}

function uiEntityKey(alert: Alert): string | null {
  if (alert.entity.type === "day") {
    const code: AlertCode = alert.code;
    if (code === "day_missing_end_lodging") {
      return `lodging-end:${alert.entity.id}`;
    }
    if (code === "day_missing_lodging") {
      return `lodging-start:${alert.entity.id}`;
    }
    return null;
  }
  if (alert.entity.type === "event" || alert.entity.type === "travel") {
    return alert.entity.id;
  }
  return null;
}

function formatDateRange(days: PlanForEditor["days"]): string | null {
  if (days.length === 0) return null;
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
  const first = sorted[0].date;
  const last = sorted[sorted.length - 1].date;
  if (first === last) return formatShort(first);
  return `${formatShort(first)} – ${formatShort(last)}`;
}

function formatShort(iso: string): string {
  return parseISO(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
