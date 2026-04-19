"use client";

import { useEffect } from "react";

import { useSelection } from "@/stores/selection";

type Props = {
  planId: string;
  initialDayId: string | null;
};

export function SelectionHydrator({ planId, initialDayId }: Props) {
  useEffect(() => {
    useSelection.getState().setCurrentDay(initialDayId);
  }, [planId, initialDayId]);
  return null;
}
