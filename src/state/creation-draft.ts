import { create } from 'zustand';

/**
 * Photos chosen for a multi-photo tool (collage, slideshow), kept here
 * rather than in the route so a long selection never ends up in a URL.
 */
type DraftState = {
  ids: readonly string[];
  setIds: (ids: readonly string[]) => void;
};

export const useCreationDraft = create<DraftState>()((set) => ({
  ids: [],
  setIds: (ids) => set({ ids }),
}));
