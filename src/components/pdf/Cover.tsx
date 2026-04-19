import { Page, Text, View } from "@react-pdf/renderer";

import { styles } from "@/components/pdf/styles";
import type { BrochureData } from "@/components/pdf/types";

type Props = {
  plan: BrochureData["plan"];
};

export function Cover({ plan }: Props) {
  return (
    <Page size="A4" style={styles.coverPage}>
      <View style={styles.coverBand}>
        <Text style={styles.coverTitle}>{plan.name}</Text>
        <Text style={styles.coverSubtitle}>
          {plan.dateRange} · {plan.dayCount}{" "}
          {plan.dayCount === 1 ? "day" : "days"}
        </Text>
      </View>

      <View style={styles.coverBody}>
        <Text style={styles.coverMeta}>Time zone · {plan.tz}</Text>

        {plan.destinations.length > 0 ? (
          <View>
            <Text style={styles.coverDestLabel}>Destinations</Text>
            {plan.destinations.map((d, i) => (
              <Text key={`${i}-${d}`} style={styles.coverDestItem}>
                • {d}
              </Text>
            ))}
          </View>
        ) : null}
      </View>
    </Page>
  );
}
