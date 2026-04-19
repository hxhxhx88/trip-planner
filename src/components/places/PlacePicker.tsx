"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Search } from "lucide-react";

import { PlacePreview } from "@/components/places/PlacePreview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { AutocompleteHit, PlaceDetails } from "@/lib/google/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCommit: (details: PlaceDetails) => Promise<void> | void;
  trigger?: React.ReactElement;
};

export function PlacePicker({ open, onOpenChange, onCommit, trigger }: Props) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      {trigger ? <PopoverTrigger render={trigger} /> : null}
      <PopoverContent className="w-96" align="start">
        {open ? (
          <PickerBody
            onCommit={onCommit}
            onClose={() => onOpenChange(false)}
          />
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

type Mode =
  | { kind: "search" }
  | { kind: "loading"; placeId: string }
  | { kind: "preview"; details: PlaceDetails };

function PickerBody({
  onCommit,
  onClose,
}: {
  onCommit: (details: PlaceDetails) => Promise<void> | void;
  onClose: () => void;
}) {
  const [sessionToken] = useState(() => crypto.randomUUID());
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<AutocompleteHit[]>([]);
  const [highlight, setHighlight] = useState(0);
  const [mode, setMode] = useState<Mode>({ kind: "search" });
  const [committing, setCommitting] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const trimmed = query.trim();

  useEffect(() => {
    if (mode.kind !== "search") return;
    if (!trimmed) return;
    const handle = setTimeout(() => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      const params = new URLSearchParams({ q: trimmed, sessionToken });
      fetch(`/api/places/autocomplete?${params}`, { signal: ac.signal })
        .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
        .then((data: AutocompleteHit[]) => {
          setHits(data.slice(0, 5));
          setHighlight(0);
        })
        .catch((e) => {
          if (e?.name !== "AbortError") console.error("autocomplete failed", e);
        });
    }, 250);
    return () => {
      clearTimeout(handle);
      abortRef.current?.abort();
    };
  }, [trimmed, mode.kind, sessionToken]);

  const visibleHits = trimmed ? hits : [];

  const pickHit = useCallback((hit: AutocompleteHit) => {
    setMode({ kind: "loading", placeId: hit.placeId });
    const params = new URLSearchParams({ placeId: hit.placeId });
    fetch(`/api/places/details?${params}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((details: PlaceDetails) => {
        setMode({ kind: "preview", details });
      })
      .catch((e) => {
        console.error("place details failed", e);
        setMode({ kind: "search" });
      });
  }, []);

  const commit = useCallback(async () => {
    if (mode.kind !== "preview") return;
    setCommitting(true);
    try {
      await onCommit(mode.details);
      onClose();
    } finally {
      setCommitting(false);
    }
  }, [mode, onCommit, onClose]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (mode.kind !== "search" || visibleHits.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => (h + 1) % visibleHits.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => (h - 1 + visibleHits.length) % visibleHits.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const hit = visibleHits[highlight];
      if (hit) pickHit(hit);
    }
  };

  if (mode.kind === "loading") {
    return <PlacePreview place={null} loading />;
  }

  if (mode.kind === "preview") {
    return (
      <div className="flex flex-col gap-3">
        <PlacePreview
          place={{
            googlePlaceId: mode.details.googlePlaceId,
            name: mode.details.name,
            address: mode.details.address,
            category: mode.details.category,
            photos: mode.details.photos,
            hours: mode.details.hours,
            hoursSource: "google",
          }}
        />
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setMode({ kind: "search" })}
            disabled={committing}
          >
            Back
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={commit}
            disabled={committing}
          >
            {committing ? <Loader2 className="size-4 animate-spin" /> : null}
            Use this place
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Search a place…"
          className="pl-8"
        />
      </div>
      {visibleHits.length === 0 ? (
        <div className="px-1 py-2 text-xs text-muted-foreground">
          {trimmed ? "No matches." : "Start typing to search Google Places."}
        </div>
      ) : (
        <ul className="flex flex-col">
          {visibleHits.map((hit, i) => (
            <li key={hit.placeId}>
              <button
                type="button"
                onClick={() => pickHit(hit)}
                onMouseEnter={() => setHighlight(i)}
                className={
                  "w-full rounded px-2 py-1.5 text-left text-sm" +
                  (i === highlight ? " bg-muted" : " hover:bg-muted")
                }
              >
                <div className="truncate font-medium">{hit.primary}</div>
                {hit.secondary ? (
                  <div className="truncate text-xs text-muted-foreground">
                    {hit.secondary}
                  </div>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
