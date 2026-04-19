import { minutesToHhmm } from "@/lib/time";

type Props = {
  axisStartMin: number;
  axisEndMin: number;
  pxPerMin: number;
};

function labelAt(minutes: number): string {
  return minutesToHhmm(((minutes % 1440) + 1440) % 1440);
}

export function HoursAxis({ axisStartMin, axisEndMin, pxPerMin }: Props) {
  const heightPx = Math.round((axisEndMin - axisStartMin) * pxPerMin);

  const hourTicks: { min: number; top: number }[] = [];
  const firstHour = Math.ceil(axisStartMin / 60) * 60;
  for (let m = firstHour; m <= axisEndMin; m += 60) {
    hourTicks.push({
      min: m,
      top: Math.round((m - axisStartMin) * pxPerMin),
    });
  }

  const halfHourTicks: number[] = [];
  const firstHalf = Math.ceil(axisStartMin / 30) * 30;
  for (let m = firstHalf; m <= axisEndMin; m += 30) {
    if (m % 60 === 0) continue;
    halfHourTicks.push(Math.round((m - axisStartMin) * pxPerMin));
  }

  return (
    <div
      className="relative w-14 shrink-0 border-r text-[10px] text-muted-foreground"
      style={{ height: heightPx }}
      aria-hidden
    >
      {halfHourTicks.map((top, i) => (
        <div
          key={`sub-${i}`}
          className="absolute inset-x-0 border-t border-dashed border-border/40"
          style={{ top }}
        />
      ))}
      {hourTicks.map((t) => (
        <div
          key={t.min}
          className="absolute inset-x-0 border-t border-border"
          style={{ top: t.top }}
        >
          <span className="absolute right-1.5 -translate-y-1/2 bg-background px-1 tabular-nums">
            {labelAt(t.min)}
          </span>
        </div>
      ))}
    </div>
  );
}
