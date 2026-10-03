import { Storage } from 'expo-sqlite/kv-store';
import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';

import {
  PREFERENCES_VERSION,
  defaultPreferences,
  sanitizePreferences,
  type AppearancePreference,
  type Preferences,
} from './preferences-schema';

export type { AppearancePreference } from './preferences-schema';

type PreferencesState = Preferences & {
  setAppearance: (appearance: AppearancePreference) => void;
  setLessMotion: (lessMotion: boolean) => void;
  setHaptics: (haptics: boolean) => void;
};

const STORAGE_KEY = 'mediacare.preferences';

/**
 * Synchronous SQLite key-value storage, so preferences are available on the
 * very first render (no light-mode flash for a dark-mode user). Storage
 * failures are swallowed: preferences are a convenience, and the app must
 * still start with defaults if the store is unreadable.
 */
const syncStorage: StateStorage = {
  getItem: (key) => {
    try {
      return Storage.getItemSync(key);
    } catch {
      return null;
    }
  },
  setItem: (key, value) => {
    try {
      Storage.setItemSync(key, value);
    } catch {
      // Not persisted this time; the in-memory value still applies.
    }
  },
  removeItem: (key) => {
    try {
      Storage.removeItemSync(key);
    } catch {
      // Nothing to remove.
    }
  },
};

/**
 * Small UI preferences, persisted on device. Media data never goes in this
 * store.
 */
export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => ({
      ...defaultPreferences,
      setAppearance: (appearance) => set({ appearance }),
      setLessMotion: (lessMotion) => set({ lessMotion }),
      setHaptics: (haptics) => set({ haptics }),
    }),
    {
      name: STORAGE_KEY,
      version: PREFERENCES_VERSION,
      storage: createJSONStorage(() => syncStorage),
      // Persist data only, never the setter functions.
      partialize: ({ appearance, lessMotion, haptics }) => ({ appearance, lessMotion, haptics }),
      // Validate whatever comes back from disk before it reaches the UI.
      merge: (persisted, current) => ({ ...current, ...sanitizePreferences(persisted) }),
      // Future schema changes migrate here; for now any unknown version is sanitized.
      migrate: (persisted) => sanitizePreferences(persisted),
    },
  ),
);
