import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { gutter, spacing, useTheme } from '@/theme';

import { AppText } from './app-text';
import { useBottomChromeHeight } from './tab-bar';

type ScreenProps = {
  /** Editorial large title rendered in the content, Apple Music style. */
  title: string;
  /** Trailing control beside the title, e.g. the Settings button. */
  headerAccessory?: ReactNode;
  children: ReactNode;
};

/**
 * Scrolling tab-root screen with a large in-content title. Leaves room for the
 * status bar on top and the translucent tab bar below.
 */
export function Screen({ title, headerAccessory, children }: ScreenProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomChrome = useBottomChromeHeight();

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + spacing.xs, paddingBottom: bottomChrome + spacing.xxl },
      ]}
      scrollIndicatorInsets={{ bottom: bottomChrome }}
      contentInsetAdjustmentBehavior="never"
    >
      <View style={styles.header}>
        <AppText variant="largeTitle" style={styles.title}>
          {title}
        </AppText>
        {headerAccessory}
      </View>
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: gutter,
    gap: spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: -spacing.sm,
  },
  title: { flexShrink: 1 },
});
