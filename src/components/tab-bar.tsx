import type { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { spacing, useTheme } from '@/theme';

import { AppText } from './app-text';
import { ChromeBackground } from './chrome-background';
import { Icon, type IconName } from './icon';

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

/** Height of the tab row above the home-indicator inset. */
export const TAB_ROW_HEIGHT = 52;

/** Space scroll content must leave at the bottom so nothing hides under the chrome. */
export function useBottomChromeHeight(): number {
  const insets = useSafeAreaInsets();
  return TAB_ROW_HEIGHT + insets.bottom;
}

const TAB_ICONS: Record<string, IconName> = {
  index: 'clean',
  library: 'library',
  studio: 'studio',
};

/**
 * Translucent tab bar. Tab switches are instant by design (they happen
 * dozens of times a session); the selected tab is shown by tint, weight and
 * the accessibility "selected" state.
 *
 * The compact active-job bar (docs/SCREENS.md) will sit directly above this
 * row, and only while a real job runs. No job exists in Phase 0, so nothing
 * renders there.
 */
export function TabBar({ state, descriptors, navigation }: TabBarProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[styles.container, { paddingBottom: insets.bottom, borderTopColor: colors.separator }]}
    >
      <ChromeBackground />
      <View style={styles.row} accessibilityRole="tablist">
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const options = descriptors[route.key].options;
          const label = typeof options.title === 'string' ? options.title : route.name;
          const color = focused ? colors.accent : colors.secondaryLabel;

          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={label}
              style={styles.item}
              onPress={() => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!focused && !event.defaultPrevented) {
                  navigation.navigate(route.name, route.params);
                }
              }}
              onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
            >
              <Icon
                name={TAB_ICONS[route.name] ?? 'photo'}
                size={24}
                color={color}
                weight={focused ? 'semibold' : 'regular'}
              />
              <AppText
                variant="caption"
                style={{ color, fontWeight: focused ? '600' : '500' }}
                maxFontSizeMultiplier={1.4}
              >
                {label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    height: TAB_ROW_HEIGHT,
    paddingTop: spacing.xs - 2,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
});
