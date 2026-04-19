import fs from "node:fs";

import { Image, Page, Text, View } from "@react-pdf/renderer";

import { DetailCard } from "@/components/pdf/DetailCard";
import { Footer } from "@/components/pdf/Footer";
import { formatDayHeader, formatTravel } from "@/components/pdf/format";
import { COLORS, styles } from "@/components/pdf/styles";
import type { BrochureData, BrochureDay } from "@/components/pdf/types";
import type { TimelineItem } from "@/components/editor/timeline/types";
import { minutesToHhmm } from "@/lib/time";
import { VEHICLE_LABEL } from "@/lib/vehicles";

type Props = {
  data: BrochureData;
  day: BrochureDay;
  dayIndex: number;
};

function hourLabel(min: number): string {
  const normalized = ((min % 1440) + 1440) % 1440;
  return minutesToHhmm(normalized);
}

function Timeline({ timeline }: { timeline: BrochureDay["timeline"] }) {
  const { axisStartMin, axisEndMin, pxPerMin, heightPx, items } = timeline;

  const hourTicks: { min: number; top: number }[] = [];
  const firstHour = Math.ceil(axisStartMin / 60) * 60;
  for (let m = firstHour; m <= axisEndMin; m += 60) {
    hourTicks.push({
      min: m,
      top: Math.round((m - axisStartMin) * pxPerMin),
    });
  }
  const halfHourTops: number[] = [];
  const firstHalf = Math.ceil(axisStartMin / 30) * 30;
  for (let m = firstHalf; m <= axisEndMin; m += 30) {
    if (m % 60 === 0) continue;
    halfHourTops.push(Math.round((m - axisStartMin) * pxPerMin));
  }

  return (
    <View style={styles.timelineFrame}>
      <View style={{ position: "relative", height: heightPx }}>
        {halfHourTops.map((top, i) => (
          <View key={`h-${i}`} style={[styles.timelineHalfHourLine, { top }]} />
        ))}
        {hourTicks.map((t) => (
          <View key={`t-${t.min}`}>
            <View style={[styles.timelineHourLine, { top: t.top }]} />
            <Text
              style={[styles.timelineAxisLabel, { top: t.top - 3, left: 4 }]}
            >
              {hourLabel(t.min)}
            </Text>
          </View>
        ))}

        {items.map((item) => (
          <TimelineItemView key={`${item.kind}-${item.id}`} item={item} />
        ))}
      </View>
    </View>
  );
}

function TimelineItemView({ item }: { item: TimelineItem }) {
  if (item.kind === "event") {
    return (
      <View
        style={[styles.timelineEvent, { top: item.top, height: item.height }]}
      >
        {item.height >= 18 ? (
          <>
            <Text style={styles.timelineEventText}>
              {item.placeName ?? "Unplaced"}
            </Text>
            <Text style={styles.timelineEventTime}>
              {item.startLabel}–{item.endLabel}
            </Text>
          </>
        ) : (
          <Text style={styles.timelineEventText}>
            {item.placeName ?? "Unplaced"}
          </Text>
        )}
      </View>
    );
  }

  if (item.kind === "travel") {
    const vehicleLabel = item.vehicle ? VEHICLE_LABEL[item.vehicle] : "Travel";
    const timeLabel = formatTravel(item.travelTime);
    if (item.status === "span") {
      return (
        <View
          style={[
            styles.timelineTravelSpan,
            { top: item.top, height: item.height },
          ]}
        >
          {item.height >= 14 ? (
            <View
              style={{
                position: "absolute",
                top: item.height / 2 - 5,
                left: -18,
                right: -18,
                alignItems: "center",
              }}
            >
              <View style={styles.timelineTravelChip}>
                <Text style={styles.timelineTravelChipText}>
                  {vehicleLabel} · {timeLabel}
                </Text>
              </View>
            </View>
          ) : null}
        </View>
      );
    }
    return (
      <View
        style={[
          styles.timelineTravelChip,
          { top: item.top, height: item.height },
        ]}
      >
        <Text style={styles.timelineTravelChipText}>
          {vehicleLabel} · {timeLabel}
        </Text>
      </View>
    );
  }

  // lodging
  return (
    <View
      style={[
        styles.timelineLodgingLabel,
        {
          top: item.anchor === "start" ? item.top : item.top - 10,
          alignItems: "center",
        },
      ]}
    >
      <Text style={styles.timelineLodgingTime}>{item.time}</Text>
      <Text style={styles.timelineLodgingText}>{item.label ?? "Lodging"}</Text>
    </View>
  );
}

function isHttpUrl(s: string): boolean {
  return s.startsWith("http://") || s.startsWith("https://");
}

function MapFrame({ path }: { path: string | null }) {
  const usable = path != null && (isHttpUrl(path) || fs.existsSync(path));
  return (
    <View style={styles.mapFrame}>
      {usable ? (
        // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image, not DOM img
        <Image src={path} style={styles.mapImage} />
      ) : (
        <View style={styles.mapPlaceholder}>
          <Text style={styles.mapPlaceholderText}>Map unavailable</Text>
          <Text style={[styles.meta, { marginTop: 4 }]}>
            Will render once the route handler supplies a static-map URL.
          </Text>
        </View>
      )}
    </View>
  );
}

export function PerDay({ data, day, dayIndex }: Props) {
  const unscheduled = day.timeline.unscheduled;
  return (
    <Page size="A4" style={styles.page} wrap>
      <View style={styles.dayHeader}>
        <Text style={styles.dayKicker}>Day {dayIndex + 1}</Text>
        <Text style={styles.dayTitle}>{formatDayHeader(day.date)}</Text>
        {day.titleSummary ? (
          <Text style={styles.daySummary}>{day.titleSummary}</Text>
        ) : null}
      </View>

      <View style={styles.dayGrid} wrap={false}>
        <Timeline timeline={day.timeline} />
        <MapFrame path={day.mapImagePath} />
      </View>

      {unscheduled.length > 0 ? (
        <View style={[styles.section, { marginBottom: 8 }]}>
          <Text style={[styles.meta, { color: COLORS.warning }]}>
            {unscheduled.length} unscheduled{" "}
            {unscheduled.length === 1 ? "item" : "items"} not shown on timeline.
          </Text>
        </View>
      ) : null}

      <Text style={[styles.h3, { marginBottom: 6 }]}>Stops</Text>
      {day.cards.map((card, i) => (
        <DetailCard key={`${dayIndex}-${i}`} card={card} />
      ))}

      <Footer
        planName={data.plan.name}
        generatedAt={data.generatedAt}
        alertSummary={data.alertSummary}
      />
    </Page>
  );
}
