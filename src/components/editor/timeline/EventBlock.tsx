"use client";

import type { TimelineItem } from "@/components/editor/timeline/types";
import { cn } from "@/lib/utils";

type Props = {
  item: Extract<TimelineItem, { kind: "event" }>;
  selected: boolean;
  onClick: () => void;
  onHover: (hovering: boolean) => void;
  registerRef?: (id: string, el: HTMLElement | null) => void;
};

export function EventBlock({
  item,
  selected,
  onClick,
  onHover,
  registerRef,
}: Props) {
  return (
    <button
      ref={(el) => registerRef?.(item.id, el)}
      type="button"
      onClick={onClick}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      className={cn(
        "absolute left-2 right-2 flex flex-col items-start gap-0.5 overflow-hidden rounded-md border border-primary/40 bg-primary/10 px-2 py-1 text-left text-xs transition-colors hover:bg-primary/15",
        selected && "ring-2 ring-primary",
      )}
      style={{ top: item.top, height: item.height }}
    >
      <span className="flex w-full items-center gap-1">
        <span className="truncate font-medium">
          {item.placeName ?? (
            <span className="text-muted-foreground italic">No place</span>
          )}
        </span>
        <span aria-label="alert slot" className="ml-auto shrink-0" />
      </span>
      <span className="text-[10px] tabular-nums text-muted-foreground">
        {item.startLabel}–{item.endLabel}
      </span>
    </button>
  );
}
