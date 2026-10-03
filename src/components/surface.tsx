import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { radius, shadows, spacing, useTheme } from '@/theme';

type SurfaceProps = {
  children: ReactNode;
  /** `raised` adds a soft shadow in light mode; dark mode separates by color only. */
  elevation?: 'flat' | 'raised';
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Surface({ children, elevation = 'flat', padded = true, style }: SurfaceProps) {
  const { colors, scheme } = useTheme();
  return (
    <View
      style={[
        styles.base,
        { backgroundColor: colors.surface },
        padded && styles.padded,
        elevation === 'raised' && scheme === 'light' && { boxShadow: shadows.card },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.card,
    borderCurve: 'continuous',
  },
  padded: { padding: spacing.md },
});
