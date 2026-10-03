import { StyleSheet } from 'react-native';

import { minTouchTarget, radius, useTheme } from '@/theme';

import { Icon, type IconName } from './icon';
import { PressableScale } from './pressable-scale';

type IconButtonProps = {
  icon: IconName;
  /** Required: icon-only controls have no visible text for VoiceOver. */
  accessibilityLabel: string;
  onPress?: () => void;
  /** `filled` sits on photos or busy backgrounds; `plain` sits on page chrome. */
  variant?: 'plain' | 'filled';
};

export function IconButton({
  icon,
  accessibilityLabel,
  onPress,
  variant = 'filled',
}: IconButtonProps) {
  const { colors } = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[styles.base, variant === 'filled' && { backgroundColor: colors.surfaceRaised }]}
    >
      <Icon name={icon} size={18} color={colors.label} weight="semibold" />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    width: minTouchTarget,
    height: minTouchTarget,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
