import { Badge } from "@/components/ui/badge";

export function StatusBadge({ releasedSlug }: { releasedSlug: string | null }) {
  if (releasedSlug) {
    return (
      <Badge
        variant="outline"
        className="border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
      >
        Released
      </Badge>
    );
  }
  return <Badge variant="secondary">Draft</Badge>;
}
