import { AlertTriangle, ChevronDown } from "lucide-react";

import type { Alert } from "@/lib/schemas";
import { cn } from "@/lib/utils";

type Props = {
  alerts: Alert[];
};

export function ReleasedAlerts({ alerts }: Props) {
  if (alerts.length === 0) return null;

  const issues = alerts.filter((a) => a.severity === "issue");
  const warnings = alerts.filter((a) => a.severity === "warning");

  return (
    <details
      className={cn(
        "group rounded-xl border text-sm",
        issues.length > 0
          ? "border-red-500/40 bg-red-500/5"
          : "border-amber-500/40 bg-amber-500/5",
      )}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <AlertTriangle
            className={cn(
              "size-4 shrink-0",
              issues.length > 0 ? "text-red-500" : "text-amber-500",
            )}
          />
          <span className="font-medium">Heads up</span>
          <span className="text-xs text-muted-foreground">
            {formatCounts(issues.length, warnings.length)}
          </span>
        </div>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t px-4 py-3">
        {issues.length > 0 ? (
          <Section
            title="Issues"
            severity="issue"
            alerts={issues}
          />
        ) : null}
        {warnings.length > 0 ? (
          <div className={cn(issues.length > 0 && "mt-3")}>
            <Section
              title="Warnings"
              severity="warning"
              alerts={warnings}
            />
          </div>
        ) : null}
      </div>
    </details>
  );
}

function Section({
  title,
  severity,
  alerts,
}: {
  title: string;
  severity: "issue" | "warning";
  alerts: Alert[];
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
      <ul className="space-y-1.5">
        {alerts.map((a, i) => (
          <li
            key={`${a.code}-${a.entity.type}-${a.entity.id}-${i}`}
            className="leading-snug"
          >
            <p>{a.message}</p>
            {a.hint ? (
              <p className="text-xs text-muted-foreground">{a.hint}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

function formatCounts(issues: number, warnings: number): string {
  const parts: string[] = [];
  if (issues > 0) parts.push(`${issues} issue${issues === 1 ? "" : "s"}`);
  if (warnings > 0) parts.push(`${warnings} warning${warnings === 1 ? "" : "s"}`);
  return parts.join(" · ");
}
