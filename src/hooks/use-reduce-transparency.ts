import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/** Tracks the iOS Reduce Transparency setting. Always false where unsupported. */
export function useReduceTransparency(): boolean {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceTransparencyEnabled()
      .then((value) => {
        if (mounted) setEnabled(value);
      })
      .catch(() => {
        // Unsupported platform: keep the translucent default.
      });
    const subscription = AccessibilityInfo.addEventListener(
      'reduceTransparencyChanged',
      setEnabled,
    );
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return enabled;
}
