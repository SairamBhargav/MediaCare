import { router, useIsFocused, type Href } from 'expo-router';
import { useEffect, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { TAB_ORDER, swipeTarget, type TabName } from '@/domain/tabs';
import { springs, useReduceMotion } from '@/theme';
import { haptics } from '@/utils/haptics';

const HREF: Record<TabName, Href> = { index: '/', library: '/library', studio: '/studio' };

/** How much of the finger's travel the page follows (rubber band at the ends). */
const FOLLOW = 0.4;
const EDGE_FOLLOW = 0.12;

function goTo(target: TabName) {
  haptics.light();
  router.navigate(HREF[target]);
}

/**
 * Swipe sideways anywhere on a tab to move to the next or previous tab. The
 * page follows the finger on the UI thread while dragging, then the tab
 * switches with a haptic; a short drag springs back. Horizontal only: it
 * gives way to vertical scrolling, and taps never trigger it. Under Reduce
 * Motion the page doesn't move; the switch still happens.
 */
export function TabSwipe({ routeName, children }: { routeName: string; children: ReactNode }) {
  const reduceMotion = useReduceMotion();
  const focused = useIsFocused();
  const offset = useSharedValue(0);
  const index = TAB_ORDER.indexOf(routeName as TabName);
  const hasNext = index >= 0 && index < TAB_ORDER.length - 1;
  const hasPrevious = index > 0;

  // Once this tab has shifted out of view, put it back for next time.
  useEffect(() => {
    if (focused) return;
    const timer = setTimeout(() => offset.set(0), 350);
    return () => clearTimeout(timer);
  }, [focused, offset]);

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
        scheduleOnRN(goTo, target);
      } else {
        offset.set(withSpring(0, { ...springs.snap, velocity: event.velocityX * FOLLOW }));
      }
    });

  const style = useAnimatedStyle(() => ({ transform: [{ translateX: offset.get() }] }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.fill, style]} collapsable={false}>
        {children}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
