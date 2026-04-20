import { create } from "zustand";

export type PreviewPlace = {
  placeId: string;
  lat: number;
  lng: number;
  name: string;
};

type PreviewState = {
  place: PreviewPlace | null;
  set: (p: PreviewPlace | null) => void;
};

export const usePreview = create<PreviewState>((set) => ({
  place: null,
  set: (p) => set({ place: p }),
}));
