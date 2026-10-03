import * as Haptics from 'expo-haptics';

import { usePreferences } from '@/state/preferences';

/**
 * Haptics gated by the user's preference. Every call is fire-and-forget and
 * swallows failures: haptics are never the only feedback, so a device without
 * a Taptic Engine (or with system haptics off) loses nothing.
 */
function enabled(): boolean {
  return usePreferences.getState().haptics;
}

export const haptics = {
  /** A value ticked: selecting a photo, a segmented control, a picker detent. */
  selection() {
    if (enabled()) Haptics.selectionAsync().catch(() => {});
  },
  /** Something snapped home or a drag committed. */
  light() {
    if (enabled()) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  },
  /** An operation finished successfully (export saved, review applied). */
  success() {
    if (enabled()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
  },
  /** An operation failed. */
  error() {
    if (enabled()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    }
  },
};
