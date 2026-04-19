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
  selected: boolean;
  hovered: boolean;
  onClick: () => void;
  onHover: (hovering: boolean) => void;
};

export function Polyline({
  vehicle,
  routePath,
  selected,
  hovered,
  onClick,
  onHover,
}: Props) {
  if (!vehicle || routePath.length < 2) return null;
  const path = routePath.map(([lat, lng]) => ({ lat, lng }));
  const strokeWeight = selected ? 5 : 4;
  const strokeOpacity = selected ? 1 : hovered ? 0.95 : 0.85;
  return (
    <VisPolyline
      path={path}
      strokeColor={VEHICLE_COLORS[vehicle]}
      strokeWeight={strokeWeight}
      strokeOpacity={strokeOpacity}
      clickable
      onClick={onClick}
      onMouseOver={() => onHover(true)}
      onMouseOut={() => onHover(false)}
    />
  );
}
