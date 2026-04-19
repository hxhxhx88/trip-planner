import { create } from "zustand";

type SelectSource = "map" | "pane" | null;

type SelectionState = {
  currentDayId: string | null;
  selectedId: string | null;
  selectSource: SelectSource;
  hoveredId: string | null;
  setCurrentDay: (id: string | null) => void;
  select: (id: string | null, source?: Exclude<SelectSource, null>) => void;
  hover: (id: string | null) => void;
};

const HOVER_DEBOUNCE_MS = 50;
let hoverTimer: ReturnType<typeof setTimeout> | null = null;

export const useSelection = create<SelectionState>((set) => ({
  currentDayId: null,
  selectedId: null,
  selectSource: null,
  hoveredId: null,
  setCurrentDay: (id) =>
    set({
      currentDayId: id,
      selectedId: null,
      selectSource: null,
      hoveredId: null,
    }),
  select: (id, source = "pane") =>
    set({ selectedId: id, selectSource: id === null ? null : source }),
  hover: (id) => {
    if (hoverTimer !== null) clearTimeout(hoverTimer);
    hoverTimer = setTimeout(() => {
      hoverTimer = null;
      set({ hoveredId: id });
    }, HOVER_DEBOUNCE_MS);
  },
}));
