import { TabRouter, withLayoutContext, type TabNavigationState } from 'expo-router';
import {
  createNavigatorFactory,
  useNavigationBuilder,
  type DefaultNavigatorOptions,
  type Descriptor,
  type NavigationHelpers,
  type ParamListBase,
  type TabRouterOptions,
} from 'expo-router/react-navigation';
import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { dragOffset, pageOffset, settlePage } from '@/domain/tabs';
import { springs } from '@/theme';
import { haptics } from '@/utils/haptics';

export type PagerTabOptions = { title?: string };
export type PagerTabEventMap = {
  tabPress: { data: undefined; canPreventDefault: true };
  tabLongPress: { data: undefined };
};

type PagerState = TabNavigationState<ParamListBase>;
type PagerNavigation = NavigationHelpers<ParamListBase, PagerTabEventMap>;
type PagerDescriptors = Record<string, Descriptor<PagerTabOptions, never, never>>;

export type PagerTabBarProps = {
  state: PagerState;
  descriptors: Record<string, { options: PagerTabOptions }>;
  navigation: PagerNavigation;
};

type PagerTabsProps = DefaultNavigatorOptions<
  ParamListBase,
  string | undefined,
  PagerState,
  PagerTabOptions,
  PagerTabEventMap,
  PagerNavigation
> &
  TabRouterOptions & {
    tabBar: (props: PagerTabBarProps) => ReactNode;
  };

/**
 * Tabs as side-by-side pages, like Instagram: swipe anywhere to move between
 * them. The strip follows the finger 1:1 on the UI thread (no React work
 * per frame), resists past the first and last page, and on release settles
 * on the page the flick points to, one page at most, with a haptic. Tapping
 * a tab jumps there instantly. Every page stays mounted, so the next one is
 * already drawn while you drag.
 */
function PagerTabsNavigator({
  id,
  initialRouteName,
  backBehavior,
  children,
  layout,
  screenListeners,
  screenOptions,
  screenLayout,
  UNSTABLE_router,
  tabBar,
}: PagerTabsProps) {
  const { state, descriptors, navigation, NavigationContent } = useNavigationBuilder<
    PagerState,
    TabRouterOptions,
    Record<string, () => void>,
    PagerTabOptions,
    PagerTabEventMap
  >(TabRouter, {
    id,
    initialRouteName,
    backBehavior,
    children,
    layout,
    screenListeners,
    screenOptions,
    screenLayout,
    UNSTABLE_router,
  });

  return (
    <NavigationContent>
      <View style={styles.fill}>
        <Pager
          state={state}
          descriptors={descriptors as unknown as PagerDescriptors}
          navigation={navigation as unknown as PagerNavigation}
        />
        {tabBar({ state, descriptors, navigation: navigation as unknown as PagerNavigation })}
      </View>
    </NavigationContent>
  );
}

function Pager({
  state,
  descriptors,
  navigation,
}: {
  state: PagerState;
  descriptors: PagerDescriptors;
  navigation: PagerNavigation;
}) {
  const { width } = useWindowDimensions();
  const count = state.routes.length;
  const index = state.index;
  const offset = useSharedValue(pageOffset(index, width));
  const start = useSharedValue(0);
  /** The page the strip is on or heading to; set on the UI thread when a swipe ends. */
  const page = useSharedValue(index);
  const routeNames = state.routes.map((route) => route.name);

  // Tab taps and links change the index without a swipe: jump there at once.
  // After a swipe, `page` already matches, and the settle spring keeps running.
  useEffect(() => {
    if (page.get() === index) return;
    cancelAnimation(offset);
    page.set(index);
    offset.set(pageOffset(index, width));
  }, [index, offset, page, width]);

  // Rotation or a size change: stay on the current page.
  useEffect(() => {
    cancelAnimation(offset);
    offset.set(pageOffset(page.get(), width));
  }, [width, offset, page]);

  const goTo = (target: number) => {
    haptics.light();
    navigation.navigate(routeNames[target]);
  };

  const pan = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-10, 10])
    .onStart(() => {
      cancelAnimation(offset);
      start.set(offset.get());
    })
    .onUpdate((event) => {
      offset.set(dragOffset(start.get(), event.translationX, width, count));
    })
    .onEnd((event) => {
      const current = page.get();
      const target = settlePage(offset.get(), event.velocityX, width, current, count);
      offset.set(
        withSpring(pageOffset(target, width), { ...springs.page, velocity: event.velocityX }),
      );
      if (target !== current) {
        page.set(target);
        scheduleOnRN(goTo, target);
      }
    });

  const stripStyle = useAnimatedStyle(() => ({ transform: [{ translateX: offset.get() }] }));

  return (
    <GestureDetector gesture={pan}>
      <View style={styles.clip} collapsable={false}>
        <Animated.View style={[styles.strip, { width: width * count }, stripStyle]}>
          {state.routes.map((route, routeIndex) => {
            const focused = routeIndex === index;
            return (
              <View
                key={route.key}
                style={[styles.page, { width }]}
                // Only the current page is reachable with VoiceOver.
                accessibilityElementsHidden={!focused}
                importantForAccessibility={focused ? 'auto' : 'no-hide-descendants'}
              >
                {descriptors[route.key].render()}
              </View>
            );
          })}
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  clip: { flex: 1, overflow: 'hidden' },
  strip: { flex: 1, flexDirection: 'row' },
  page: { height: '100%' },
});

const createPagerTabs = createNavigatorFactory(PagerTabsNavigator);

export const PagerTabs = withLayoutContext<
  PagerTabOptions,
  typeof PagerTabsNavigator,
  PagerState,
  PagerTabEventMap
>(createPagerTabs().Navigator);
