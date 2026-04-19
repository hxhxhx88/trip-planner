import { create } from "zustand";

type SelectionState = {
  currentDayId: string | null;
  selectedId: string | null;
  hoveredId: string | null;
  setCurrentDay: (id: string | null) => void;
  select: (id: string | null) => void;
  hover: (id: string | null) => void;
};

export const useSelection = create<SelectionState>((set) => ({
  currentDayId: null,
  selectedId: null,
  hoveredId: null,
  setCurrentDay: (id) =>
    set({ currentDayId: id, selectedId: null, hoveredId: null }),
  select: (id) => set({ selectedId: id }),
  hover: (id) => set({ hoveredId: id }),
}));
