"use client";

import { DayContent } from "@/components/editor/DayContent";
import { DayTabs } from "@/components/editor/DayTabs";
import type { PlanForEditor } from "@/lib/model/plan";
import { useSelection } from "@/stores/selection";

type Props = {
  data: PlanForEditor;
};

export function RightPane({ data }: Props) {
  const currentDayId = useSelection((s) => s.currentDayId);
  const day =
    data.days.find((d) => d.id === currentDayId) ?? data.days[0] ?? null;

  return (
    <div className="flex h-full flex-col">
      <DayTabs
        planId={data.plan.id}
        timezone={data.plan.timezone}
        days={data.days}
      />
      {day ? (
        <DayContent
          planId={data.plan.id}
          day={day}
          days={data.days}
          events={data.events}
          travels={data.travels}
          places={data.places}
        />
      ) : (
        <div className="p-6 text-sm text-muted-foreground">
          No day selected.
        </div>
      )}
    </div>
  );
}
