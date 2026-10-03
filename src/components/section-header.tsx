import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { spacing } from '@/theme';

import { AppText } from './app-text';

type SectionHeaderProps = {
  title: string;
  /** Optional kicker above the title, e.g. "Sample" or "Today". */
  eyebrow?: string;
  /** Optional trailing control, usually a plain Button. */
  action?: ReactNode;
};

export function SectionHeader({ title, eyebrow, action }: SectionHeaderProps) {
  return (
    <View style={styles.row}>
      <View style={styles.titles}>
        {eyebrow ? (
          <AppText variant="eyebrow" color="secondaryLabel">
            {eyebrow}
          </AppText>
        ) : null}
        <AppText variant="title2">{title}</AppText>
      </View>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  titles: { flexShrink: 1, gap: 2 },
});
