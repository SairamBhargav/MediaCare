import { Tabs, router, useRootNavigationState } from 'expo-router';
import { useEffect } from 'react';

import { TabBar } from '@/components/tab-bar';
import { TabSwipe } from '@/components/tab-swipe';
import { usePreferences } from '@/state/preferences';
import { useReduceMotion } from '@/theme';

export default function TabsLayout() {
  // First run: the introduction appears over the tabs once, until finished
  // or skipped (P1-ONB-003). Preferences hydrate synchronously, so this is
  // decided on the first render; navigating waits until the navigator is ready.
  const onboardingSeen = usePreferences((state) => state.onboardingSeen);
  const navigationReady = Boolean(useRootNavigationState()?.key);
  const reduceMotion = useReduceMotion();
  useEffect(() => {
    if (navigationReady && !onboardingSeen) router.push('/welcome');
  }, [navigationReady, onboardingSeen]);

  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      // A short sideways shift tells you which way you moved; none under Reduce Motion.
      screenOptions={{ headerShown: false, animation: reduceMotion ? 'none' : 'shift' }}
      screenLayout={({ route, children }) => <TabSwipe routeName={route.name}>{children}</TabSwipe>}
    >
      <Tabs.Screen name="index" options={{ title: 'Clean' }} />
      <Tabs.Screen name="library" options={{ title: 'Library' }} />
      <Tabs.Screen name="studio" options={{ title: 'Studio' }} />
    </Tabs>
  );
}
