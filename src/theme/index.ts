import { useColorScheme } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { usePreferences } from '@/state/preferences';

import { useIncreaseContrast } from '@/hooks/use-increase-contrast';

import { highContrastPalettes, palettes, type ColorScheme, type Palette } from './colors';

export * from './colors';
export * from './motion';
export * from './tokens';

/**
 * The resolved color scheme and palette. The appearance preference is applied
 * through `Appearance.setColorScheme` in the root layout, so
 * `useColorScheme` already reflects a light/dark override and native chrome
 * (sheets, alerts, keyboards) follows it too. With iOS Increase Contrast on,
 * the high-contrast variant of the scheme is used.
 */
export function useTheme(): { scheme: ColorScheme; colors: Palette; highContrast: boolean } {
  const scheme: ColorScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const highContrast = useIncreaseContrast();
  return { scheme, colors: (highContrast ? highContrastPalettes : palettes)[scheme], highContrast };
}

/**
 * True when motion should be reduced: the system Reduce Motion setting OR the
 * in-app "less motion" preference. The in-app switch can only add reduction.
 */
export function useReduceMotion(): boolean {
  const systemReduced = useReducedMotion();
  const lessMotion = usePreferences((state) => state.lessMotion);
  return systemReduced || lessMotion;
}
