import { router, useIsFocused, type Href } from 'expo-router';
import { useEffect, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { TAB_ORDER, swipeTarget, type TabName } from '@/domain/tabs';
import { noteTabMove, takeTabMove } from '@/state/tab-motion';
import { duration, easing, springs, useReduceMotion } from '@/theme';
import { haptics } from '@/utils/haptics';

const HREF: Record<TabName, Href> = { index: '/', library: '/library', studio: '/studio' };

/** How much of the finger's travel the page follows (rubber band at the ends). */
const FOLLOW = 0.4;
const EDGE_FOLLOW = 0.12;
/** How far a newly shown tab slides in from. */
const SLIDE_IN = 56;

function goTo(from: string, target: TabName) {
  haptics.light();
  noteTabMove(from, target);
  router.navigate(HREF[target]);
}

/**
 * Swipe sideways anywhere on a tab to move to the next or previous tab. The
 * page follows the finger on the UI thread while dragging, then the tab
 * switches with a haptic; a short drag springs back. A tab that appears
 * (swiped to or tapped) slides in a little from the side it came from.
 *
 * Only transforms and opacity on the UI thread: the navigator itself
 * switches instantly, so hidden tabs stay frozen and cost nothing. Under
 * Reduce Motion nothing moves; switching still works.
 */
export function TabSwipe({ routeName, children }: { routeName: string; children: ReactNode }) {
  const reduceMotion = useReduceMotion();
  const focused = useIsFocused();
  const offset = useSharedValue(0);
  const opacity = useSharedValue(1);
  const index = TAB_ORDER.indexOf(routeName as TabName);
  const hasNext = index >= 0 && index < TAB_ORDER.length - 1;
  const hasPrevious = index > 0;

  useEffect(() => {
    if (!focused) {
      offset.set(0);
      opacity.set(1);
      return;
    }
    const from = takeTabMove();
    if (from === 0 || reduceMotion) return;
    offset.set(from * SLIDE_IN);
    opacity.set(0.4);
    const timing = { duration: duration.surface, easing: easing.out };
    offset.set(withTiming(0, timing));
    opacity.set(withTiming(1, timing));
  }, [focused, offset, opacity, reduceMotion]);

  const pan = Gesture.Pan()
    .activeOffsetX([-20, 20])
    .failOffsetY([-14, 14])
    .onUpdate((event) => {
      if (reduceMotion) return;
      const x = event.translationX;
      const open = x < 0 ? hasNext : hasPrevious;
      offset.set(x * (open ? FOLLOW : EDGE_FOLLOW));
    })
    .onEnd((event) => {
      const target = swipeTarget(routeName, event.translationX, event.velocityX);
      if (target) {
        scheduleOnRN(goTo, routeName, target);
      } else {
        offset.set(withSpring(0, { ...springs.snap, velocity: event.velocityX * FOLLOW }));
      }
    });

  const style = useAnimatedStyle(() => ({
    opacity: opacity.get(),
    transform: [{ translateX: offset.get() }],
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.fill, style]} collapsable={false}>
        {children}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
