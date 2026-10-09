import { create } from 'zustand';

import { TOUR_STEPS } from '@/features/tour/steps';
import { usePreferences } from '@/state/preferences';

/**
 * Where the guided tour is. Finishing or skipping marks it seen, so it
 * starts by itself only once; Settings → Help starts it again.
 */
type TourState = {
  active: boolean;
  index: number;
  start: () => void;
  next: () => void;
  back: () => void;
  /** Ends the tour (Skip or Done) and remembers it was seen. */
  stop: () => void;
  /** A highlighted control was tapped for real; moves on if the step asks for that. */
  tapped: (anchorId: string) => void;
};

export const useTour = create<TourState>()((set, get) => ({
  active: false,
  index: 0,
  start: () => set({ active: true, index: 0 }),
  next: () => {
    const { active, index } = get();
    if (!active) return;
    if (index >= TOUR_STEPS.length - 1) get().stop();
    else set({ index: index + 1 });
  },
  back: () => {
    const { active, index } = get();
    if (active && index > 0) set({ index: index - 1 });
  },
  stop: () => {
    set({ active: false, index: 0 });
    usePreferences.getState().setTourSeen(true);
  },
  tapped: (anchorId) => {
    const { active, index } = get();
    const step = TOUR_STEPS[index];
    if (active && step?.tapToContinue && step.target === anchorId) get().next();
  },
}));
