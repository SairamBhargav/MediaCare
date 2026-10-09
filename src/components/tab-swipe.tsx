import { router, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { swipeTarget, type TabName } from '@/domain/tabs';

const HREF: Record<TabName, Href> = { index: '/', library: '/library', studio: '/studio' };

/**
 * Swipe sideways anywhere on a tab to move to the next or previous tab.
 * Horizontal only: it gives way to vertical scrolling, and taps never
 * trigger it. The tab bar stays the main way to switch; this is a shortcut.
 */
export function TabSwipe({ routeName, children }: { routeName: string; children: ReactNode }) {
  const pan = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetX([-24, 24])
    .failOffsetY([-14, 14])
    .onEnd((event) => {
      const target = swipeTarget(routeName, event.translationX, event.velocityX);
      if (target) router.navigate(HREF[target]);
    });

  return (
    <GestureDetector gesture={pan}>
      <View style={styles.fill} collapsable={false}>
        {children}
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
