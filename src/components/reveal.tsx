import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { duration, easing, spacing, useReduceMotion } from '@/theme';

/** At most this many groups take part; later ones appear with the last. */
export const MAX_REVEAL_GROUPS = 4;

let revealedThisSession = false;

/**
 * The home screen's one-time reveal (P1-MOT-001). `ready` turns true the
 * first time the screen is actually on screen (not under the first-run
 * introduction); `animate` is decided once, so the reveal plays at most once
 * per app session and never under Reduce Motion.
 */
export function useSessionReveal(focused: boolean): { ready: boolean; animate: boolean } {
  const reduceMotion = useReduceMotion();
  const [animate] = useState(() => !revealedThisSession && !reduceMotion);
  useEffect(() => {
    if (focused) revealedThisSession = true;
  }, [focused]);
  return { ready: focused || revealedThisSession, animate };
}

/** Test hook: forget that the reveal played. */
export function resetSessionReveal() {
  revealedThisSession = false;
}

/**
 * One above-the-fold group in a staggered reveal: fades up into place,
 * 40 ms after the previous group. Lays out the same whether or not it
 * animates (children keep the screen's section gap).
 */
export function RevealGroup({
  index,
  animate,
  children,
}: {
  index: number;
  animate: boolean;
  children: ReactNode;
}) {
  const position = Math.min(index, MAX_REVEAL_GROUPS - 1);
  return (
    <Animated.View
      style={styles.group}
      entering={
        animate
          ? FadeInDown.delay(position * duration.stagger)
              .duration(duration.surface)
              .easing(easing.out)
          : undefined
      }
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.xxl },
});
