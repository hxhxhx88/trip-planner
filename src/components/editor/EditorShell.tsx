"use client";

import { useCallback, useMemo } from "react";
import { toast } from "sonner";

import { addEvent } from "@/actions/events";
import { runAutoFill } from "@/actions/autofill";
import { AlertPanel } from "@/components/alerts/AlertPanel";
import { EmptyPlanCTA } from "@/components/editor/EmptyPlanCTA";
import { RightPane } from "@/components/editor/RightPane";
import { SplitPane } from "@/components/editor/SplitPane";
import type { EditorView } from "@/components/editor/ViewToggle";
import { MapPane } from "@/components/map/MapPane";
import { isTypingTarget, useKeydown, useLocalStorage } from "@/lib/hooks";
import type { PlanForEditor } from "@/lib/model/plan";
import type { Alert } from "@/lib/schemas";
import { validate } from "@/lib/validate";
import { useSelection } from "@/stores/selection";

type Props = {
  data: PlanForEditor;
};

export function EditorShell({ data }: Props) {
  const planId = data.plan.id;
  const alerts = useMemo(() => validate(data), [data]);
  const alertsByEntity = useMemo(() => groupByEntity(alerts), [alerts]);

  const [, setView] = useLocalStorage<EditorView>(
    `editor:view:${planId}`,
    "table",
  );

  const onKey = useCallback(
    (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      const typing = isTypingTarget(e.target);

      if (meta && e.key === "Enter") {
        e.preventDefault();
        if (typing && document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        return;
      }

      if (typing || e.altKey || meta) return;

      if (e.key === "T") {
        e.preventDefault();
        setView("timeline");
        return;
      }
      if (e.key === "t") {
        e.preventDefault();
        setView("table");
        return;
      }
      if (e.key === "a" || e.key === "A") {
        e.preventDefault();
        void (async () => {
          const res = await runAutoFill({ planId });
          if (!res.ok) {
            toast.error(res.error.message);
            return;
          }
          const issues = res.data.alerts.filter(
            (a) => a.severity === "issue",
          ).length;
          const warnings = res.data.alerts.filter(
            (a) => a.severity === "warning",
          ).length;
          toast.success(
            `Auto Fill complete · ${issues} issue${issues === 1 ? "" : "s"}, ${warnings} warning${warnings === 1 ? "" : "s"}`,
          );
        })();
        return;
      }
      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        const dayId = useSelection.getState().currentDayId;
        if (!dayId) return;
        void (async () => {
          const res = await addEvent({ planId, dayId });
          if (!res.ok) toast.error(res.error.message);
        })();
        return;
      }
    },
    [planId, setView],
  );

  useKeydown(onKey);

  const banner = (
    <div
      role="note"
      className="flex items-start gap-2 border-b bg-amber-50 px-4 py-2 text-xs text-amber-900 lg:hidden dark:bg-amber-950/40 dark:text-amber-200"
    >
      <span>
        The planner works best on a larger screen — use a released URL on mobile.
      </span>
    </div>
  );

  if (data.days.length === 0) {
    return (
      <div className="flex h-full flex-col">
        {banner}
        <div className="grid flex-1 grid-cols-[1fr_auto] overflow-hidden">
          <SplitPane
            left={<MapPane data={data} />}
            right={
              <EmptyPlanCTA planId={planId} timezone={data.plan.timezone} />
            }
          />
          <AlertPanel
            alerts={alerts}
            days={data.days}
            events={data.events}
            travels={data.travels}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {banner}
      <div className="grid flex-1 grid-cols-[1fr_auto] overflow-hidden">
        <SplitPane
          left={<MapPane data={data} />}
          right={<RightPane data={data} alertsByEntity={alertsByEntity} />}
        />
        <AlertPanel
          alerts={alerts}
          days={data.days}
          events={data.events}
          travels={data.travels}
        />
      </div>
    </div>
  );
}

function groupByEntity(alerts: Alert[]): Record<string, Alert[]> {
  const out: Record<string, Alert[]> = {};
  for (const a of alerts) {
    const key = uiKeyFor(a);
    if (!out[key]) out[key] = [];
    out[key].push(a);
  }
  return out;
}

function uiKeyFor(alert: Alert): string {
  if (alert.entity.type === "day") {
    if (alert.code === "day_missing_end_lodging") {
      return `lodging-end:${alert.entity.id}`;
    }
    return `lodging-start:${alert.entity.id}`;
  }
  return alert.entity.id;
}
