import { create } from 'zustand';

import type { Rect } from '@/domain/viewer-geometry';

/**
 * Where the viewer was opened from: the tapped tile's id and its rectangle
 * in window coordinates, so the viewer can grow out of it and return to it.
 * While the viewer shows, that tile is hidden (`hiddenId`) so the photo
 * appears to move rather than duplicate.
 */
type ViewerOriginState = {
  origin: { id: string; rect: Rect } | null;
  hiddenId: string | null;
  setOrigin: (id: string, rect: Rect | null) => void;
  hideTile: (id: string | null) => void;
};

export const useViewerOrigin = create<ViewerOriginState>()((set) => ({
  origin: null,
  hiddenId: null,
  setOrigin: (id, rect) => set({ origin: rect ? { id, rect } : null }),
  hideTile: (hiddenId) => set({ hiddenId }),
}));
