import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

import { PlanRowActions } from "@/components/plans/PlanRowActions";
import { StatusBadge } from "@/components/plans/StatusBadge";
import type { PlanListRow } from "@/lib/model/plans";

function formatDateRange(firstDate: string | null, lastDate: string | null, dayCount: number) {
  if (!firstDate || !lastDate || dayCount === 0) return "No days";
  if (firstDate === lastDate) return formatShort(firstDate);
  return `${formatShort(firstDate)} – ${formatShort(lastDate)}`;
}

function formatShort(iso: string) {
  const [y, m, d] = iso.split("-");
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function PlansList({ rows }: { rows: PlanListRow[] }) {
  return (
    <div className="overflow-hidden rounded-lg border">
      <table className="w-full divide-y text-sm">
        <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-3 text-left font-medium">Name</th>
            <th className="px-4 py-3 text-left font-medium">Dates</th>
            <th className="px-4 py-3 text-left font-medium">Status</th>
            <th className="px-4 py-3 text-left font-medium">Last edited</th>
            <th className="px-4 py-3 text-right font-medium">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row) => (
            <tr key={row.id} className="hover:bg-muted/30">
              <td className="px-4 py-3 font-medium">
                <Link
                  href={`/plans/${row.id}/edit`}
                  className="hover:underline"
                >
                  {row.name}
                </Link>
                <div className="text-xs text-muted-foreground">
                  {row.timezone}
                </div>
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {formatDateRange(row.firstDate, row.lastDate, row.dayCount)}
              </td>
              <td className="px-4 py-3">
                <StatusBadge releasedSlug={row.releasedSlug} />
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {formatDistanceToNow(row.updatedAt, { addSuffix: true })}
              </td>
              <td className="px-4 py-3 text-right">
                <PlanRowActions planId={row.id} name={row.name} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
