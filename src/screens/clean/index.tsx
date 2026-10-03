import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { IconButton } from '@/components/icon-button';
import { Screen } from '@/components/screen';
import { StatusPill } from '@/components/status-pill';
import { Surface } from '@/components/surface';
import { spacing, useTheme } from '@/theme';

import { SampleReview } from './sample-review';

export function CleanScreen() {
  const { colors } = useTheme();

  return (
    <Screen
      title="Clean"
      headerAccessory={
        <IconButton
          icon="settings"
          accessibilityLabel="Settings"
          onPress={() => router.push('/settings')}
        />
      }
    >
      <Surface elevation="raised" style={styles.intro}>
        <StatusPill label="Not scanned" icon="info" />
        <AppText variant="title1">Keep the memories that matter.</AppText>
        <AppText variant="body" color="secondaryLabel">
          MediaCare finds repeat shots and photos that didn’t turn out, then lets you decide what
          stays. Nothing is removed without your review.
        </AppText>
        <View style={[styles.notice, { backgroundColor: colors.surfaceRaised }]}>
          <Icon name="lock" size={16} color={colors.secondaryLabel} />
          <AppText variant="footnote" color="secondaryLabel" style={styles.noticeText}>
            This early build doesn’t ask for photo access. Try the review below with sample images
            instead.
          </AppText>
        </View>
      </Surface>

      <SampleReview />
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { gap: spacing.sm, padding: spacing.lg },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: 12,
    marginTop: spacing.xxs,
  },
  noticeText: { flex: 1 },
});
