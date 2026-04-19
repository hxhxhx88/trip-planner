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
  const selectedId = useSelection((s) => s.selectedId);
  const hoveredId = useSelection((s) => s.hoveredId);
  const select = useSelection((s) => s.select);
  const hover = useSelection((s) => s.hover);

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
            onClick={() => select(null, "map")}
            style={{ width: "100%", height: "100%" }}
          >
            {mapDay.startLodging && (
              <LodgingPin
                position={{
                  lat: mapDay.startLodging.lat,
                  lng: mapDay.startLodging.lng,
                }}
                name={mapDay.startLodging.name}
                selected={selectedId === mapDay.startLodging.id}
                hovered={hoveredId === mapDay.startLodging.id}
                onClick={() => select(mapDay.startLodging!.id, "map")}
                onHover={(h) =>
                  hover(h ? mapDay.startLodging!.id : null)
                }
              />
            )}
            {mapDay.endLodging && (
              <LodgingPin
                position={{
                  lat: mapDay.endLodging.lat,
                  lng: mapDay.endLodging.lng,
                }}
                name={mapDay.endLodging.name}
                selected={selectedId === mapDay.endLodging.id}
                hovered={hoveredId === mapDay.endLodging.id}
                onClick={() => select(mapDay.endLodging!.id, "map")}
                onHover={(h) => hover(h ? mapDay.endLodging!.id : null)}
              />
            )}
            {mapDay.events.map((e) => (
              <EventPin
                key={e.id}
                position={{ lat: e.lat, lng: e.lng }}
                name={e.name}
                visitNumber={e.visitNumber}
                selected={selectedId === e.id}
                hovered={hoveredId === e.id}
                onClick={() => select(e.id, "map")}
                onHover={(h) => hover(h ? e.id : null)}
              />
            ))}
            {mapDay.travels.map((t) => (
              <Polyline
                key={t.id}
                vehicle={t.vehicle}
                routePath={t.routePath}
                selected={selectedId === t.id}
                hovered={hoveredId === t.id}
                onClick={() => select(t.id, "map")}
                onHover={(h) => hover(h ? t.id : null)}
              />
            ))}
            <FitBounds mapDay={mapDay} />
            <PanToSelected mapDay={mapDay} />
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

function PanToSelected({ mapDay }: { mapDay: MapDay }) {
  const map = useMap();
  const selectedId = useSelection((s) => s.selectedId);
  const selectSource = useSelection((s) => s.selectSource);

  useEffect(() => {
    if (!map || !selectedId) return;
    if (selectSource === "map") return;

    const minZoom = 15;
    const pan = (lat: number, lng: number) => {
      map.panTo({ lat, lng });
      const z = map.getZoom();
      if (typeof z === "number" && z < minZoom) map.setZoom(minZoom);
      else if (typeof z !== "number") map.setZoom(minZoom);
    };

    if (mapDay.startLodging && mapDay.startLodging.id === selectedId) {
      pan(mapDay.startLodging.lat, mapDay.startLodging.lng);
      return;
    }
    if (mapDay.endLodging && mapDay.endLodging.id === selectedId) {
      pan(mapDay.endLodging.lat, mapDay.endLodging.lng);
      return;
    }
    const event = mapDay.events.find((e) => e.id === selectedId);
    if (event) {
      pan(event.lat, event.lng);
      return;
    }
    const travel = mapDay.travels.find((t) => t.id === selectedId);
    if (travel) {
      const bounds = new google.maps.LatLngBounds();
      for (const [lat, lng] of travel.routePath) bounds.extend({ lat, lng });
      map.fitBounds(bounds, 48);
    }
  }, [map, selectedId, selectSource, mapDay]);

  return null;
}
