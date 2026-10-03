import { useSyncExternalStore } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

/**
 * iOS Settings → Accessibility → Display & Text Size → Increase Contrast,
 * read through React Native's `isDarkerSystemColorsEnabled` (UIKit's
 * `UIAccessibilityDarkerSystemColorsEnabled`). One shared native listener
 * for the whole app, so every `useTheme()` call stays cheap. Always false
 * where unsupported.
 */
let enabled = false;
let started = false;
const listeners = new Set<() => void>();

function set(value: boolean) {
  if (value === enabled) return;
  enabled = value;
  listeners.forEach((listener) => listener());
}

function start() {
  if (started || Platform.OS !== 'ios') return;
  started = true;
  AccessibilityInfo.isDarkerSystemColorsEnabled()
    .then(set)
    .catch(() => {
      // Unsupported: keep the standard palette.
    });
  AccessibilityInfo.addEventListener('darkerSystemColorsChanged', set);
}

function subscribe(listener: () => void) {
  start();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = () => enabled;

export function useIncreaseContrast(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
