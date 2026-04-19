"use client";

import { useMemo } from "react";

import { AlertPanel } from "@/components/alerts/AlertPanel";
import { EmptyPlanCTA } from "@/components/editor/EmptyPlanCTA";
import { RightPane } from "@/components/editor/RightPane";
import { SplitPane } from "@/components/editor/SplitPane";
import { MapPane } from "@/components/map/MapPane";
import type { PlanForEditor } from "@/lib/model/plan";
import type { Alert } from "@/lib/schemas";
import { validate } from "@/lib/validate";

type Props = {
  data: PlanForEditor;
};

export function EditorShell({ data }: Props) {
  const alerts = useMemo(() => validate(data), [data]);
  const alertsByEntity = useMemo(() => groupByEntity(alerts), [alerts]);

  if (data.days.length === 0) {
    return (
      <div className="grid h-full grid-cols-[1fr_auto]">
        <SplitPane
          left={<MapPane data={data} />}
          right={
            <EmptyPlanCTA
              planId={data.plan.id}
              timezone={data.plan.timezone}
            />
          }
        />
        <AlertPanel
          alerts={alerts}
          days={data.days}
          events={data.events}
          travels={data.travels}
        />
      </div>
    );
  }

  return (
    <div className="grid h-full grid-cols-[1fr_auto]">
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
