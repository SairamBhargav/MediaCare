/**
 * Shape, defaults and validation for persisted preferences. Pure: no React,
 * no storage. Anything read back from disk passes through
 * `sanitizePreferences`, so a corrupted or outdated value falls back to the
 * default for that field instead of crashing the app.
 */
export type AppearancePreference = 'system' | 'light' | 'dark';

export type Preferences = {
  appearance: AppearancePreference;
  /** In-app "less motion". Can only reduce motion, never override the system setting. */
  lessMotion: boolean;
  haptics: boolean;
};

export const PREFERENCES_VERSION = 1;

export const defaultPreferences: Preferences = {
  appearance: 'system',
  lessMotion: false,
  haptics: true,
};

const APPEARANCES: readonly AppearancePreference[] = ['system', 'light', 'dark'];

function isAppearance(value: unknown): value is AppearancePreference {
  return typeof value === 'string' && (APPEARANCES as readonly string[]).includes(value);
}

/** Keeps every valid field from `input` and uses the default for the rest. */
export function sanitizePreferences(input: unknown): Preferences {
  if (typeof input !== 'object' || input === null) return { ...defaultPreferences };
  const record = input as Record<string, unknown>;
  return {
    appearance: isAppearance(record.appearance) ? record.appearance : defaultPreferences.appearance,
    lessMotion:
      typeof record.lessMotion === 'boolean' ? record.lessMotion : defaultPreferences.lessMotion,
    haptics: typeof record.haptics === 'boolean' ? record.haptics : defaultPreferences.haptics,
  };
}
