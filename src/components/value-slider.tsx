import { Host, Slider } from '@expo/ui';
import { StyleSheet, View } from 'react-native';

import { spacing, useTheme } from '@/theme';

import { AppText } from './app-text';
import { IconButton } from './icon-button';

/**
 * A labelled native slider with − and + buttons: the buttons give a precise
 * step and an alternative to dragging; VoiceOver can also adjust the slider.
 */
export function ValueSlider({
  label,
  value,
  valueText,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  valueText: string;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.wrap}>
      <View style={styles.top}>
        <AppText variant="subhead">{label}</AppText>
        <AppText variant="subhead" color="secondaryLabel" style={styles.numbers}>
          {valueText}
        </AppText>
      </View>
      <View style={styles.row}>
        <IconButton
          icon="minus"
          accessibilityLabel={`Less ${label.toLowerCase()}`}
          onPress={() => onChange(Math.max(min, value - step))}
        />
        <Host style={styles.slider} matchContents={{ vertical: true }} seedColor={colors.accent}>
          <Slider value={value} min={min} max={max} step={step} onValueChange={onChange} />
        </Host>
        <IconButton
          icon="plus"
          accessibilityLabel={`More ${label.toLowerCase()}`}
          onPress={() => onChange(Math.min(max, value + step))}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xxs },
  top: { flexDirection: 'row', justifyContent: 'space-between' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  slider: { flex: 1 },
  numbers: { fontVariant: ['tabular-nums'] },
});
