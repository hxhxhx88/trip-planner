import { Document } from "@react-pdf/renderer";

import { Cover } from "@/components/pdf/Cover";
import "@/components/pdf/fonts";
import { Overview } from "@/components/pdf/Overview";
import { PerDay } from "@/components/pdf/PerDay";
import type { BrochureData } from "@/components/pdf/types";

type Props = {
  data: BrochureData;
};

export function BrochureDocument({ data }: Props) {
  return (
    <Document
      title={data.plan.name}
      author="Travel Planner"
      subject={`${data.plan.name} — itinerary`}
    >
      <Cover plan={data.plan} />
      <Overview data={data} />
      {data.days.map((day, i) => (
        <PerDay key={day.date} data={data} day={day} dayIndex={i} />
      ))}
    </Document>
  );
}
