import { create } from 'zustand';

export type AppearancePreference = 'system' | 'light' | 'dark';

type PreferencesState = {
  appearance: AppearancePreference;
  /** In-app "less motion". Can only reduce motion, never override the system setting. */
  lessMotion: boolean;
  haptics: boolean;
  setAppearance: (appearance: AppearancePreference) => void;
  setLessMotion: (lessMotion: boolean) => void;
  setHaptics: (haptics: boolean) => void;
};

/**
 * Small UI preferences. In-memory for Phase 0; persistence is backlog task
 * P1-SET-002 (docs/BACKLOG.md). Media data never goes in this store.
 */
export const usePreferences = create<PreferencesState>()((set) => ({
  appearance: 'system',
  lessMotion: false,
  haptics: true,
  setAppearance: (appearance) => set({ appearance }),
  setLessMotion: (lessMotion) => set({ lessMotion }),
  setHaptics: (haptics) => set({ haptics }),
}));
