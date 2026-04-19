"use client";

import { EmptyPlanCTA } from "@/components/editor/EmptyPlanCTA";
import { MapPanePlaceholder } from "@/components/editor/MapPanePlaceholder";
import { RightPane } from "@/components/editor/RightPane";
import { SplitPane } from "@/components/editor/SplitPane";
import type { PlanForEditor } from "@/lib/model/plan";

type Props = {
  data: PlanForEditor;
};

export function EditorShell({ data }: Props) {
  if (data.days.length === 0) {
    return (
      <SplitPane
        left={<MapPanePlaceholder days={[]} />}
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
      left={<MapPanePlaceholder days={data.days} />}
      right={<RightPane data={data} />}
    />
  );
}
