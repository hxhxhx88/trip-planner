"use client";

import { useMemo } from "react";
import { BedDouble } from "lucide-react";

import { EventBlock } from "@/components/editor/timeline/EventBlock";
import { HoursAxis } from "@/components/editor/timeline/HoursAxis";
import { TravelConnector } from "@/components/editor/timeline/TravelConnector";
import { UnscheduledPill } from "@/components/editor/timeline/UnscheduledPill";
import type { TimelineItem } from "@/components/editor/timeline/types";
import type { DayEvent, DayRef, DayTravel } from "@/lib/model/day";
import type { PlanForEditor } from "@/lib/model/plan";
import { toTimelineModel } from "@/lib/model/timeline";
import { cn } from "@/lib/utils";
import { useSelection } from "@/stores/selection";

type Props = {
  day: DayRef;
  events: DayEvent[];
  travels: DayTravel[];
  places: PlanForEditor["places"];
  pxPerMin?: number;
  onOpenInTable: (id: string) => void;
};

export function TimelineView({
  day,
  events,
  travels,
  places,
  pxPerMin = 0.5,
  onOpenInTable,
}: Props) {
  const model = useMemo(
    () => toTimelineModel({ day, events, travels, places, pxPerMin }),
    [day, events, travels, places, pxPerMin],
  );

  const selectedId = useSelection((s) => s.selectedId);
  const hover = useSelection((s) => s.hover);

  const lodgingItems = model.items.filter(
    (i): i is Extract<TimelineItem, { kind: "lodging" }> => i.kind === "lodging",
  );
  const eventItems = model.items.filter(
    (i): i is Extract<TimelineItem, { kind: "event" }> => i.kind === "event",
  );
  const travelItems = model.items.filter(
    (i): i is Extract<TimelineItem, { kind: "travel" }> => i.kind === "travel",
  );

  const handleHover = (id: string | null) => {
    hover(id);
  };

  return (
    <div>
      <div className="flex">
        <HoursAxis
          axisStartMin={model.axisStartMin}
          axisEndMin={model.axisEndMin}
          pxPerMin={pxPerMin}
        />
        <div
          className="relative flex-1 bg-muted/10"
          style={{ height: model.heightPx }}
        >
          {lodgingItems.map((item) => (
            <LodgingMarker key={item.id} item={item} />
          ))}
          {travelItems.map((item) => (
            <TravelConnector
              key={item.id}
              item={item}
              selected={selectedId === item.id}
              onClick={() => onOpenInTable(item.id)}
              onHover={(h) => handleHover(h ? item.id : null)}
            />
          ))}
          {eventItems.map((item) => (
            <EventBlock
              key={item.id}
              item={item}
              selected={selectedId === item.id}
              onClick={() => onOpenInTable(item.id)}
              onHover={(h) => handleHover(h ? item.id : null)}
            />
          ))}
        </div>
      </div>
      <UnscheduledPill
        items={model.unscheduled}
        selectedId={selectedId}
        onSelect={onOpenInTable}
        onHover={handleHover}
      />
    </div>
  );
}

function LodgingMarker({
  item,
}: {
  item: Extract<TimelineItem, { kind: "lodging" }>;
}) {
  const isEnd = item.anchor === "end";
  return (
    <div
      className="absolute left-2 right-2"
      style={{
        top: item.top,
        transform: isEnd ? "translateY(-100%)" : undefined,
      }}
    >
      <div
        className={cn(
          "inline-flex items-center gap-1 rounded-md border border-amber-500/70 bg-amber-50/90 px-2 py-0.5 text-[11px] text-amber-900 shadow-sm dark:border-amber-400/60 dark:bg-amber-950/70 dark:text-amber-100",
        )}
      >
        <BedDouble className="size-3" />
        <span className="font-medium">
          {item.label ?? (isEnd ? "No end lodging" : "No start lodging")}
        </span>
      </div>
    </div>
  );
}
