"use client";

import { useEffect, useMemo } from "react";
import { format, parseISO } from "date-fns";
import { MapIcon } from "lucide-react";
import { Map, useMap } from "@vis.gl/react-google-maps";

import type { PlanForEditor } from "@/lib/model/plan";
import { toMapDay } from "@/lib/model/map";
import { useSelection } from "@/stores/selection";

import { DaySelector } from "./DaySelector";
import { EventPin, LodgingPin } from "./Pin";
import { Polyline } from "./Polyline";
import type { MapDay } from "./types";

type Props = { data: PlanForEditor };

export function MapPane({ data }: Props) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID;

  const currentDayId = useSelection((s) => s.currentDayId);
  const days = data.days;
  const resolvedDayId =
    days.find((d) => d.id === currentDayId)?.id ?? days[0]?.id ?? null;
  const currentDay = days.find((d) => d.id === resolvedDayId) ?? null;
  const headerLabel = currentDay
    ? format(parseISO(currentDay.date), "EEE, MMM d")
    : "No day selected";

  const mapDay = useMemo(
    () => toMapDay(data, resolvedDayId),
    [data, resolvedDayId],
  );

  if (!apiKey) {
    return (
      <PaneShell headerLabel={headerLabel} days={days}>
        <NoKeyPlaceholder />
      </PaneShell>
    );
  }

  const hasPoints = mapDayHasPoints(mapDay);

  return (
    <PaneShell headerLabel={headerLabel} days={days}>
      {hasPoints && mapDay ? (
        <div className="flex-1">
          <Map
            mapId={mapId}
            defaultCenter={{ lat: 0, lng: 0 }}
            defaultZoom={2}
            gestureHandling="greedy"
            disableDefaultUI={false}
            style={{ width: "100%", height: "100%" }}
          >
            {mapDay.startLodging && (
              <LodgingPin
                position={{
                  lat: mapDay.startLodging.lat,
                  lng: mapDay.startLodging.lng,
                }}
                name={mapDay.startLodging.name}
              />
            )}
            {mapDay.endLodging && (
              <LodgingPin
                position={{
                  lat: mapDay.endLodging.lat,
                  lng: mapDay.endLodging.lng,
                }}
                name={mapDay.endLodging.name}
              />
            )}
            {mapDay.events.map((e) => (
              <EventPin
                key={e.id}
                position={{ lat: e.lat, lng: e.lng }}
                name={e.name}
                visitNumber={e.visitNumber}
              />
            ))}
            {mapDay.travels.map((t) => (
              <Polyline
                key={t.id}
                vehicle={t.vehicle}
                routePath={t.routePath}
              />
            ))}
            <FitBounds mapDay={mapDay} />
          </Map>
        </div>
      ) : (
        <EmptyDayPlaceholder />
      )}
    </PaneShell>
  );
}

function PaneShell({
  headerLabel,
  days,
  children,
}: {
  headerLabel: string;
  days: PlanForEditor["days"];
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full flex-col bg-muted/40">
      <div className="flex items-center justify-between border-b bg-background/60 px-4 py-2 backdrop-blur">
        <span className="text-sm font-medium">{headerLabel}</span>
        <DaySelector days={days} />
      </div>
      {children}
    </div>
  );
}

function NoKeyPlaceholder() {
  return (
    <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-muted-foreground">
      <div className="flex flex-col items-center gap-2">
        <MapIcon className="size-6 opacity-40" />
        <span>
          Set <code className="font-mono text-xs">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code>
          {" and "}
          <code className="font-mono text-xs">NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID</code>
          {" in "}
          <code className="font-mono text-xs">.env</code> to enable the map.
        </span>
      </div>
    </div>
  );
}

function EmptyDayPlaceholder() {
  return (
    <div className="flex flex-1 items-center justify-center text-muted-foreground">
      <div className="flex flex-col items-center gap-2 text-sm">
        <MapIcon className="size-6 opacity-40" />
        <span>Pick a lodging to see the map.</span>
      </div>
    </div>
  );
}

function mapDayHasPoints(mapDay: MapDay | null): boolean {
  if (!mapDay) return false;
  return Boolean(
    mapDay.startLodging || mapDay.endLodging || mapDay.events.length > 0,
  );
}

function FitBounds({ mapDay }: { mapDay: MapDay }) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    const bounds = new google.maps.LatLngBounds();
    let count = 0;
    if (mapDay.startLodging) {
      bounds.extend({
        lat: mapDay.startLodging.lat,
        lng: mapDay.startLodging.lng,
      });
      count++;
    }
    if (mapDay.endLodging) {
      bounds.extend({
        lat: mapDay.endLodging.lat,
        lng: mapDay.endLodging.lng,
      });
      count++;
    }
    for (const e of mapDay.events) {
      bounds.extend({ lat: e.lat, lng: e.lng });
      count++;
    }
    for (const t of mapDay.travels) {
      for (const [lat, lng] of t.routePath) {
        bounds.extend({ lat, lng });
      }
    }
    if (count === 0) return;
    if (count === 1) {
      map.setCenter(bounds.getCenter());
      map.setZoom(15);
      return;
    }
    map.fitBounds(bounds, 32);
  }, [map, mapDay]);

  return null;
}
