import { BlurView } from 'expo-blur';
import { StyleSheet, View } from 'react-native';

import { useReduceTransparency } from '@/hooks/use-reduce-transparency';
import { useTheme } from '@/theme';

/**
 * Background for navigation chrome (tab bar, bottom bars): system material
 * blur, or an opaque surface when Reduce Transparency is on. Fills its
 * parent; give the parent `overflow: 'hidden'`.
 */
export function ChromeBackground() {
  const { colors, scheme } = useTheme();
  const reduceTransparency = useReduceTransparency();

  if (reduceTransparency) {
    return <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.chromeSolid }]} />;
  }
  return (
    <BlurView
      tint={scheme === 'dark' ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight'}
      intensity={100}
      style={StyleSheet.absoluteFill}
    />
  );
}
