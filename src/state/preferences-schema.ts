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
  /** The first-run introduction was finished or skipped (P1-ONB-003). */
  onboardingSeen: boolean;
  /** Removing photos is off until the user turns it on in Settings. */
  allowRemoval: boolean;
  /** Makes all app text a step bigger, on top of iOS Text Size. */
  largerText: boolean;
  /** The guided tour was finished or skipped. */
  tourSeen: boolean;
  /** Checks may download photos stored only in iCloud (ADR-0009). Off until the user turns it on. */
  includeICloud: boolean;
  /** ...also on mobile data, not only Wi-Fi. */
  icloudOnMobileData: boolean;
};

export const PREFERENCES_VERSION = 1;

export const defaultPreferences: Preferences = {
  appearance: 'system',
  lessMotion: false,
  haptics: true,
  onboardingSeen: false,
  allowRemoval: false,
  largerText: false,
  tourSeen: false,
  includeICloud: false,
  icloudOnMobileData: false,
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
    onboardingSeen:
      typeof record.onboardingSeen === 'boolean'
        ? record.onboardingSeen
        : defaultPreferences.onboardingSeen,
    allowRemoval:
      typeof record.allowRemoval === 'boolean'
        ? record.allowRemoval
        : defaultPreferences.allowRemoval,
    largerText:
      typeof record.largerText === 'boolean' ? record.largerText : defaultPreferences.largerText,
    tourSeen: typeof record.tourSeen === 'boolean' ? record.tourSeen : defaultPreferences.tourSeen,
    includeICloud:
      typeof record.includeICloud === 'boolean'
        ? record.includeICloud
        : defaultPreferences.includeICloud,
    icloudOnMobileData:
      typeof record.icloudOnMobileData === 'boolean'
        ? record.icloudOnMobileData
        : defaultPreferences.icloudOnMobileData,
  };
}
