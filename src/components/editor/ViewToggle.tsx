"use client";

import { Clock, Rows3 } from "lucide-react";

import { Button } from "@/components/ui/button";

export type EditorView = "table" | "timeline";

type Props = {
  value: EditorView;
  onChange: (v: EditorView) => void;
};

export function ViewToggle({ value, onChange }: Props) {
  return (
    <div
      role="tablist"
      aria-label="View"
      className="inline-flex items-center gap-0.5 rounded-md border bg-muted/30 p-0.5"
    >
      <Button
        type="button"
        role="tab"
        aria-selected={value === "table"}
        variant={value === "table" ? "default" : "ghost"}
        size="sm"
        onClick={() => onChange("table")}
      >
        <Rows3 />
        Table
      </Button>
      <Button
        type="button"
        role="tab"
        aria-selected={value === "timeline"}
        variant={value === "timeline" ? "default" : "ghost"}
        size="sm"
        onClick={() => onChange("timeline")}
      >
        <Clock />
        Timeline
      </Button>
    </div>
  );
}
