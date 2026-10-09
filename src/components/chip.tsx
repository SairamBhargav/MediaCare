import { StyleSheet } from 'react-native';

import { minTouchTarget, radius, spacing, useTheme } from '@/theme';

import { haptics } from '@/utils/haptics';

import { AppText } from './app-text';
import { PressableScale } from './pressable-scale';

type ChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
};

/** A selectable option in a single-choice row (radio semantics). */
export function Chip({ label, selected, onPress, disabled }: ChipProps) {
  const { colors } = useTheme();
  return (
    <PressableScale
      onPress={() => {
        if (!selected) haptics.selection();
        onPress();
      }}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled: !!disabled }}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? colors.accentFill : colors.surfaceRaised,
        },
      ]}
    >
      <AppText variant="subhead" color={selected ? 'onAccent' : 'label'} style={styles.label}>
        {label}
      </AppText>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: minTouchTarget - 8,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontWeight: '600' },
});
