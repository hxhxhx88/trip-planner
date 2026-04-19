import type {
  TimelineItem,
  TimelineModel,
} from "@/components/editor/timeline/types";

export type TimelineItemPdf = TimelineItem;

export type BrochureCard = {
  photoPath: string | null;
  name: string;
  address: string | null;
  hoursLine: string;
  description: string | null;
  remark: string | null;
};

export type BrochureDay = {
  date: string;
  titleSummary: string;
  timeline: TimelineModel;
  mapImagePath: string | null;
  cards: BrochureCard[];
};

export type BrochureData = {
  plan: {
    name: string;
    dateRange: string;
    dayCount: number;
    destinations: string[];
    tz: string;
  };
  days: BrochureDay[];
  generatedAt: string;
  alertSummary: { issues: number; warnings: number };
};
