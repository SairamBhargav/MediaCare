import * as Haptics from 'expo-haptics';

import { usePreferences } from '@/state/preferences';

/**
 * Haptics gated by the user's preference. Every call is fire-and-forget and
 * swallows failures: haptics are never the only feedback, so a device without
 * a Taptic Engine (or with system haptics off) loses nothing.
 *
 * Firm on purpose (owner feedback, 2026-10-09): taps use a medium impact and
 * ticks a light impact, rather than the very faint system selection tick.
 */
function enabled(): boolean {
  return usePreferences.getState().haptics;
}

function impact(style: Haptics.ImpactFeedbackStyle) {
  if (enabled()) Haptics.impactAsync(style).catch(() => {});
}

export const haptics = {
  /** A value ticked: selecting a photo, a choice chip, marking a photo. */
  selection() {
    impact(Haptics.ImpactFeedbackStyle.Light);
  },
  /** A press: buttons, icon buttons, tabs, a swipe that switched tabs, long-press. */
  light() {
    impact(Haptics.ImpactFeedbackStyle.Medium);
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
