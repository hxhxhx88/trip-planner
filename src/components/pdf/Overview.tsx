import { Page, Text, View } from "@react-pdf/renderer";

import { Footer } from "@/components/pdf/Footer";
import { styles } from "@/components/pdf/styles";
import type { BrochureData } from "@/components/pdf/types";

type Props = {
  data: BrochureData;
};

export function Overview({ data }: Props) {
  return (
    <Page size="A4" style={styles.page}>
      <View style={styles.section}>
        <Text style={styles.h2}>Trip overview</Text>
        <Text style={styles.meta}>
          {data.plan.dateRange} · {data.plan.dayCount}{" "}
          {data.plan.dayCount === 1 ? "day" : "days"}
        </Text>
      </View>

      <View>
        {data.days.map((day, i) => (
          <View key={day.date} style={styles.overviewRow}>
            <Text style={styles.overviewDayLabel}>Day {i + 1}</Text>
            <Text style={styles.overviewSummary}>{day.titleSummary}</Text>
          </View>
        ))}
      </View>

      <Footer
        planName={data.plan.name}
        generatedAt={data.generatedAt}
        alertSummary={data.alertSummary}
      />
    </Page>
  );
}
