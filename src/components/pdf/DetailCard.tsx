import { Image, Text, View } from "@react-pdf/renderer";

import { initialsOf } from "@/components/pdf/format";
import { styles } from "@/components/pdf/styles";
import type { BrochureCard } from "@/components/pdf/types";

type Props = {
  card: BrochureCard;
};

export function DetailCard({ card }: Props) {
  return (
    <View style={styles.card} wrap={false}>
      {card.photoPath ? (
        // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image, not DOM img
        <Image src={card.photoPath} style={styles.cardPhoto} />
      ) : (
        <View style={styles.cardPhotoPlaceholder}>
          <Text style={styles.cardPhotoInitials}>{initialsOf(card.name)}</Text>
        </View>
      )}

      <View style={styles.cardBody}>
        <Text style={styles.cardName}>{card.name}</Text>
        {card.address ? (
          <Text style={styles.cardAddress}>{card.address}</Text>
        ) : null}
        <Text style={styles.cardHours}>{card.hoursLine}</Text>
        {card.description ? (
          <Text style={styles.cardDescription}>{card.description}</Text>
        ) : null}
        {card.remark ? (
          <Text style={styles.cardRemark}>{card.remark}</Text>
        ) : null}
      </View>
    </View>
  );
}
