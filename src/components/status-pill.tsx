import { StyleSheet, View } from 'react-native';

import { radius, spacing, useTheme, type ColorToken } from '@/theme';

import { AppText } from './app-text';
import { Icon, type IconName } from './icon';

export type StatusTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info';

const TONES: Record<StatusTone, ColorToken> = {
  neutral: 'secondaryLabel',
  accent: 'accentText',
  success: 'success',
  warning: 'warning',
  danger: 'danger',
  info: 'info',
};

type StatusPillProps = {
  label: string;
  tone?: StatusTone;
  icon?: IconName;
};

/** A compact status label. Tone is never the only signal: the text says it. */
export function StatusPill({ label, tone = 'neutral', icon }: StatusPillProps) {
  const { colors } = useTheme();
  const color = TONES[tone];
  return (
    <View style={[styles.pill, { backgroundColor: colors.surfaceRaised }]}>
      {icon ? <Icon name={icon} size={12} color={colors[color]} weight="semibold" /> : null}
      <AppText variant="caption" color={color}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xxs,
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: spacing.xxs,
    borderRadius: radius.full,
  },
});
