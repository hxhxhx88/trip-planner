import { Text, View } from "@react-pdf/renderer";

import { styles } from "@/components/pdf/styles";
import type { BrochureData } from "@/components/pdf/types";

type Props = {
  planName: string;
  generatedAt: string;
  alertSummary: BrochureData["alertSummary"];
};

export function Footer({ planName, generatedAt, alertSummary }: Props) {
  const totalAlerts = alertSummary.issues + alertSummary.warnings;
  return (
    <View style={styles.footer} fixed>
      <View style={styles.footerLeft}>
        <Text>{planName}</Text>
        <Text>{generatedAt}</Text>
        {totalAlerts > 0 ? (
          <Text style={styles.footerAlert}>
            {totalAlerts} unresolved {totalAlerts === 1 ? "alert" : "alerts"} —
            see editor for detail.
          </Text>
        ) : null}
      </View>
      <Text
        render={({ pageNumber, totalPages }) =>
          `${pageNumber} / ${totalPages}`
        }
      />
    </View>
  );
}
