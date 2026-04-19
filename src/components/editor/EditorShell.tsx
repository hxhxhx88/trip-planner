"use client";

import { EmptyPlanCTA } from "@/components/editor/EmptyPlanCTA";
import { RightPane } from "@/components/editor/RightPane";
import { SplitPane } from "@/components/editor/SplitPane";
import { MapPane } from "@/components/map/MapPane";
import type { PlanForEditor } from "@/lib/model/plan";

type Props = {
  data: PlanForEditor;
};

export function EditorShell({ data }: Props) {
  if (data.days.length === 0) {
    return (
      <SplitPane
        left={<MapPane data={data} />}
        right={
          <EmptyPlanCTA
            planId={data.plan.id}
            timezone={data.plan.timezone}
          />
        }
      />
    );
  }

  return (
    <SplitPane
      left={<MapPane data={data} />}
      right={<RightPane data={data} />}
    />
  );
}
