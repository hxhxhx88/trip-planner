"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Alert } from "@/lib/schemas";
import { cn } from "@/lib/utils";

type Props = {
  alerts: Alert[];
  className?: string;
};

export function InlineMarker({ alerts, className }: Props) {
  if (alerts.length === 0) return null;
  const hasIssue = alerts.some((a) => a.severity === "issue");
  const severity = hasIssue ? "issue" : "warning";
  const dotClass =
    severity === "issue"
      ? "bg-red-500"
      : "bg-amber-500";
  const preview = alerts.slice(0, 3);
  const remaining = alerts.length - preview.length;
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            aria-label={`${severity} alert`}
            className={cn(
              "inline-flex items-center gap-0.5 align-middle",
              className,
            )}
          >
            <span
              className={cn("size-2 rounded-full shadow-sm", dotClass)}
              aria-hidden="true"
            />
            {alerts.length > 1 ? (
              <span
                className={cn(
                  "text-[10px] font-medium tabular-nums",
                  severity === "issue"
                    ? "text-red-600 dark:text-red-400"
                    : "text-amber-600 dark:text-amber-400",
                )}
              >
                {alerts.length}
              </span>
            ) : null}
          </span>
        }
      />
      <TooltipContent className="max-w-xs">
        <ul className="space-y-0.5 text-left">
          {preview.map((alert, i) => (
            <li key={`${alert.code}-${i}`} className="leading-snug">
              {alert.message}
            </li>
          ))}
          {remaining > 0 ? (
            <li className="text-[10px] opacity-70">
              …and {remaining} more
            </li>
          ) : null}
        </ul>
      </TooltipContent>
    </Tooltip>
  );
}
