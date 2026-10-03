import { create } from 'zustand';

/**
 * Library screen state that should outlive the screen component for the
 * session: Select mode, the current selection and where the grid was
 * scrolled to. Leaving for another tab and coming back (or the screen
 * being rebuilt) restores all three. Not persisted across launches.
 */
type LibrarySessionState = {
  selecting: boolean;
  selected: ReadonlySet<string>;
  /** Last resting vertical offset of the grid, in points. */
  scrollOffset: number;
  setSelecting: (selecting: boolean) => void;
  toggle: (id: string) => void;
  /** Drops selected ids that are no longer in the library. */
  retain: (ids: ReadonlySet<string>) => void;
  rememberOffset: (offset: number) => void;
  reset: () => void;
};

const initial = { selecting: false, selected: new Set<string>(), scrollOffset: 0 };

export const useLibrarySession = create<LibrarySessionState>()((set, get) => ({
  ...initial,
  // Entering or leaving Select mode starts with nothing selected.
  setSelecting: (selecting) => set({ selecting, selected: new Set() }),
  toggle: (id) => {
    if (!get().selecting) return;
    const selected = new Set(get().selected);
    if (selected.has(id)) selected.delete(id);
    else selected.add(id);
    set({ selected });
  },
  retain: (ids) => {
    const current = get().selected;
    const kept = [...current].filter((id) => ids.has(id));
    if (kept.length !== current.size) set({ selected: new Set(kept) });
  },
  rememberOffset: (offset) => set({ scrollOffset: Math.max(0, offset) }),
  reset: () => set({ ...initial, selected: new Set() }),
}));
