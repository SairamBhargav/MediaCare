import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { radius, spacing, useTheme } from '@/theme';

import { AppText } from './app-text';
import { Icon, type IconName } from './icon';

type EmptyStateProps = {
  icon: IconName;
  title: string;
  message: string;
  /** Error states use the danger tone on the icon; the title still says what happened. */
  tone?: 'neutral' | 'error';
  action?: ReactNode;
};

/** Empty, error and not-yet-available states share one calm layout. */
export function EmptyState({ icon, title, message, tone = 'neutral', action }: EmptyStateProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.container} accessibilityRole="summary">
      <View style={[styles.iconWell, { backgroundColor: colors.surfaceRaised }]}>
        <Icon
          name={icon}
          size={26}
          color={tone === 'error' ? colors.danger : colors.secondaryLabel}
        />
      </View>
      <AppText variant="headline" style={styles.center}>
        {title}
      </AppText>
      <AppText variant="subhead" color="secondaryLabel" style={styles.center}>
        {message}
      </AppText>
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
  },
  iconWell: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xxs,
  },
  center: { textAlign: 'center' },
  action: { marginTop: spacing.sm },
});
