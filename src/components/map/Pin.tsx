"use client";

import { AdvancedMarker, Pin as VisPin } from "@vis.gl/react-google-maps";
import { HomeIcon, MapPinIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type CommonProps = {
  position: { lat: number; lng: number };
  name: string;
  selected: boolean;
  hovered: boolean;
  onClick: () => void;
  onHover: (hovering: boolean) => void;
};

function SelectionHalo({
  selected,
  hovered,
  children,
}: {
  selected: boolean;
  hovered: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-full transition-shadow",
        selected && "ring-4 ring-primary/70",
        hovered && !selected && "ring-2 ring-primary/40",
      )}
    >
      {children}
    </div>
  );
}

type LodgingProps = CommonProps;

export function LodgingPin({
  position,
  name,
  selected,
  hovered,
  onClick,
  onHover,
}: LodgingProps) {
  return (
    <AdvancedMarker
      position={position}
      title={name}
      clickable
      onClick={onClick}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
    >
      <SelectionHalo selected={selected} hovered={hovered}>
        <VisPin background="#0f172a" glyphColor="#ffffff" borderColor="#0f172a">
          <HomeIcon className="size-3.5 text-white" />
        </VisPin>
      </SelectionHalo>
    </AdvancedMarker>
  );
}

export function PreviewPin({
  position,
  name,
}: {
  position: { lat: number; lng: number };
  name: string;
}) {
  return (
    <AdvancedMarker position={position} title={name} zIndex={1000}>
      <div className="rounded-full ring-4 ring-amber-400/80">
        <VisPin background="#f59e0b" glyphColor="#ffffff" borderColor="#b45309">
          <MapPinIcon className="size-3.5 text-white" />
        </VisPin>
      </div>
    </AdvancedMarker>
  );
}

type EventProps = CommonProps & { visitNumber: number };

export function EventPin({
  position,
  name,
  visitNumber,
  selected,
  hovered,
  onClick,
  onHover,
}: EventProps) {
  return (
    <AdvancedMarker
      position={position}
      title={name}
      clickable
      onClick={onClick}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
    >
      <SelectionHalo selected={selected} hovered={hovered}>
        <VisPin background="#2563eb" glyphColor="#ffffff" borderColor="#1e40af">
          <span className="text-xs font-semibold text-white">{visitNumber}</span>
        </VisPin>
      </SelectionHalo>
    </AdvancedMarker>
  );
}
