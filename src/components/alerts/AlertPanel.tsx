"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { PlanForEditor } from "@/lib/model/plan";
import type { Alert, AlertCode } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import { useSelection } from "@/stores/selection";

type Props = {
  alerts: Alert[];
  days: PlanForEditor["days"];
  events: PlanForEditor["events"];
  travels: PlanForEditor["travels"];
};

export function AlertPanel({ alerts, days, events, travels }: Props) {
  const [expanded, setExpanded] = useState(false);
  const currentDayId = useSelection((s) => s.currentDayId);
  const select = useSelection((s) => s.select);
  const setCurrentDay = useSelection((s) => s.setCurrentDay);

  const eventToDay = useMemo(
    () => new Map(events.map((e) => [e.id, e.dayId])),
    [events],
  );
  const travelToDay = useMemo(
    () => new Map(travels.map((t) => [t.id, t.dayId])),
    [travels],
  );

  const resolveDayId = (alert: Alert): string | null => {
    if (alert.entity.type === "day") return alert.entity.id;
    if (alert.entity.type === "event")
      return eventToDay.get(alert.entity.id) ?? null;
    if (alert.entity.type === "travel")
      return travelToDay.get(alert.entity.id) ?? null;
    return null;
  };

  const currentDayAlerts = alerts.filter(
    (a) => resolveDayId(a) === currentDayId,
  );
  const issues = currentDayAlerts.filter((a) => a.severity === "issue");
  const warnings = currentDayAlerts.filter((a) => a.severity === "warning");

  const planIssues = alerts.filter((a) => a.severity === "issue").length;
  const planWarnings = alerts.filter((a) => a.severity === "warning").length;

  const handleClick = (alert: Alert) => {
    const targetDayId = resolveDayId(alert);
    if (targetDayId && targetDayId !== currentDayId) {
      setCurrentDay(targetDayId);
    }
    select(uiTargetId(alert), "pane");
  };

  if (!expanded) {
    return (
      <aside
        aria-label="Alerts"
        className="flex w-9 shrink-0 flex-col items-center gap-2 border-l bg-muted/20 py-3"
      >
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="size-8 p-0"
          aria-label="Expand alerts"
          onClick={() => setExpanded(true)}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <AlertTriangle
          className={cn(
            "size-4",
            planIssues > 0
              ? "text-red-500"
              : planWarnings > 0
                ? "text-amber-500"
                : "text-muted-foreground/50",
          )}
        />
        <div className="flex flex-col items-center gap-1">
          {planIssues > 0 ? (
            <CountPill severity="issue" count={planIssues} />
          ) : null}
          {planWarnings > 0 ? (
            <CountPill severity="warning" count={planWarnings} />
          ) : null}
        </div>
      </aside>
    );
  }

  return (
    <aside
      aria-label="Alerts"
      className="flex w-80 shrink-0 flex-col border-l bg-muted/10"
    >
      <header className="flex items-center justify-between gap-2 border-b px-3 py-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Alerts</h3>
          <div className="flex items-center gap-1">
            {planIssues > 0 ? (
              <CountPill severity="issue" count={planIssues} />
            ) : null}
            {planWarnings > 0 ? (
              <CountPill severity="warning" count={planWarnings} />
            ) : null}
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="size-7 p-0"
          aria-label="Collapse alerts"
          onClick={() => setExpanded(false)}
        >
          <ChevronRight className="size-4" />
        </Button>
      </header>

      <div className="flex-1 overflow-y-auto px-3 py-2 text-sm">
        {currentDayAlerts.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No alerts on this day.
          </p>
        ) : (
          <div className="space-y-4">
            {issues.length > 0 ? (
              <AlertSection
                title="Issues"
                severity="issue"
                alerts={issues}
                dayLabelFor={(a) => describeDay(a, days)}
                onClick={handleClick}
              />
            ) : null}
            {warnings.length > 0 ? (
              <AlertSection
                title="Warnings"
                severity="warning"
                alerts={warnings}
                dayLabelFor={(a) => describeDay(a, days)}
                onClick={handleClick}
              />
            ) : null}
          </div>
        )}
      </div>
    </aside>
  );
}

function CountPill({
  severity,
  count,
}: {
  severity: "issue" | "warning";
  count: number;
}) {
  return (
    <span
      className={cn(
        "inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-medium tabular-nums text-white",
        severity === "issue" ? "bg-red-500" : "bg-amber-500",
      )}
    >
      {count}
    </span>
  );
}

function AlertSection({
  title,
  severity,
  alerts,
  dayLabelFor,
  onClick,
}: {
  title: string;
  severity: "issue" | "warning";
  alerts: Alert[];
  dayLabelFor: (a: Alert) => string | null;
  onClick: (a: Alert) => void;
}) {
  return (
    <section>
      <div className="mb-1 flex items-center gap-1.5">
        <span
          className={cn(
            "size-2 rounded-full",
            severity === "issue" ? "bg-red-500" : "bg-amber-500",
          )}
        />
        <h4 className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {title}
        </h4>
      </div>
      <ul className="space-y-1">
        {alerts.map((a, i) => {
          const dayLabel = dayLabelFor(a);
          return (
            <li key={`${a.code}-${a.entity.type}-${a.entity.id}-${i}`}>
              <button
                type="button"
                onClick={() => onClick(a)}
                className="block w-full rounded-md border border-transparent bg-background px-2 py-1.5 text-left text-xs shadow-sm transition-colors hover:border-border hover:bg-muted/50"
              >
                <p className="leading-snug">{a.message}</p>
                {a.hint ? (
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {a.hint}
                  </p>
                ) : null}
                {dayLabel ? (
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    {dayLabel}
                  </p>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function describeDay(
  alert: Alert,
  days: PlanForEditor["days"],
): string | null {
  if (alert.entity.type !== "day") return null;
  const day = days.find((d) => d.id === alert.entity.id);
  return day ? day.date : null;
}

function uiTargetId(alert: Alert): string {
  if (alert.entity.type === "day") {
    const code: AlertCode = alert.code;
    if (code === "day_missing_end_lodging") {
      return `lodging-end:${alert.entity.id}`;
    }
    return `lodging-start:${alert.entity.id}`;
  }
  return alert.entity.id;
}
