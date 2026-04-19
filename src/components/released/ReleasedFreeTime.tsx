import { Hourglass } from "lucide-react";

type Props = {
  minutes: number;
};

export function ReleasedFreeTime({ minutes }: Props) {
  return (
    <div className="flex items-center justify-center">
      <span className="inline-flex items-center gap-1.5 rounded-full border border-dashed bg-muted/40 px-3 py-1 text-xs text-muted-foreground">
        <Hourglass className="size-3" />
        Free time · {formatMinutes(minutes)}
      </span>
    </div>
  );
}

function formatMinutes(m: number): string {
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r === 0 ? `${h} hr` : `${h} hr ${r} min`;
}
