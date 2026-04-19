"use client";

import { AdvancedMarker, Pin as VisPin } from "@vis.gl/react-google-maps";
import { HomeIcon } from "lucide-react";

type LodgingProps = {
  position: { lat: number; lng: number };
  name: string;
};

export function LodgingPin({ position, name }: LodgingProps) {
  return (
    <AdvancedMarker position={position} title={name}>
      <VisPin background="#0f172a" glyphColor="#ffffff" borderColor="#0f172a">
        <HomeIcon className="size-3.5 text-white" />
      </VisPin>
    </AdvancedMarker>
  );
}

type EventProps = {
  position: { lat: number; lng: number };
  name: string;
  visitNumber: number;
};

export function EventPin({ position, name, visitNumber }: EventProps) {
  return (
    <AdvancedMarker position={position} title={name}>
      <VisPin background="#2563eb" glyphColor="#ffffff" borderColor="#1e40af">
        <span className="text-xs font-semibold text-white">{visitNumber}</span>
      </VisPin>
    </AdvancedMarker>
  );
}
