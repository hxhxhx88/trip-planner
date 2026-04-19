"use client";

import { Polyline as VisPolyline } from "@vis.gl/react-google-maps";

import type { Vehicle } from "@/lib/schemas";

const VEHICLE_COLORS: Record<Vehicle, string> = {
  walk: "#2563eb",
  drive: "#dc2626",
  transit: "#7c3aed",
  cycle: "#059669",
};

type Props = {
  vehicle: Vehicle | null;
  routePath: [number, number][];
};

export function Polyline({ vehicle, routePath }: Props) {
  if (!vehicle || routePath.length < 2) return null;
  const path = routePath.map(([lat, lng]) => ({ lat, lng }));
  return (
    <VisPolyline
      path={path}
      strokeColor={VEHICLE_COLORS[vehicle]}
      strokeWeight={4}
      strokeOpacity={0.85}
    />
  );
}
