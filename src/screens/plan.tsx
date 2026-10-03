import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { ChromeBackground } from '@/components/chrome-background';
import { EmptyState } from '@/components/empty-state';
import { Icon } from '@/components/icon';
import { MediaArtwork } from '@/components/media-artwork';
import { StatusPill } from '@/components/status-pill';
import { Surface } from '@/components/surface';
import { getMediaItem } from '@/features/media/registry';
import { formatBytes, formatSize } from '@/domain/bytes';
import { CATEGORY_META, countLabel } from '@/features/clean/category-meta';
import { useActionPlan } from '@/features/clean/use-action-plan';
import { gutter, radius, spacing, useTheme } from '@/theme';

const PHOTOS: [string, string] = ['photo', 'photos'];

/**
 * The removal plan: the exact photos that would be removed, what each group
 * keeps, an honest size, and what removal means on iOS (iCloud sync,
 * Recently Deleted). In Phase 1 the final button is disabled: sample data
 * can't be removed. Phase 3 connects it to the system deletion flow.
 */
export function PlanScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const plan = useActionPlan();
  const count = plan.assetIds.length;

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <AppText variant="title2">Removal plan</AppText>
        <Button title="Done" variant="plain" onPress={() => router.back()} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: FOOTER_CLEARANCE + insets.bottom },
        ]}
      >
        {count === 0 ? (
          <Surface>
            <EmptyState
              icon="check"
              title="Nothing marked yet"
              message="Mark photos in a category or in Compare. They’ll be listed here, with what each group keeps, before anything could be removed."
            />
          </Surface>
        ) : (
          <>
            <View style={styles.summary}>
              <StatusPill label="Sample" tone="accent" icon="photo" />
              <AppText variant="title1" style={styles.numbers}>
                {countLabel(count, PHOTOS)}
              </AppText>
              <AppText variant="body" color="secondaryLabel" style={styles.numbers}>
                Could free up to {formatBytes(plan.bytes)} (sample sizes). The real space freed is
                only known after removal, and Photos keeps removed items for a while.
              </AppText>
            </View>

            <Surface style={styles.warning}>
              <View style={styles.warningRow}>
                <Icon name="warning" size={18} color={colors.warning} />
                <AppText variant="headline" color="warning">
                  Before you remove
                </AppText>
              </View>
              <AppText variant="subhead">
                If iCloud Photos is on, removing photos here also removes them from your other
                devices signed in to the same Apple Account.
              </AppText>
              <AppText variant="subhead">
                Removed photos go to Recently Deleted in the Photos app, where you can restore them.
              </AppText>
            </Surface>

            {plan.excludedKeeperIds.length > 0 ? (
              <AppText variant="footnote" color="secondaryLabel">
                {countLabel(plan.excludedKeeperIds.length, PHOTOS)} you marked{' '}
                {plan.excludedKeeperIds.length === 1 ? 'is' : 'are'} a group’s keeper, so{' '}
                {plan.excludedKeeperIds.length === 1 ? 'it stays' : 'they stay'}.
              </AppText>
            ) : null}

            {plan.groups.map(({ finding, keeperId, removeIds }) => (
              <View key={finding.id} style={styles.section}>
                <AppText variant="eyebrow" color="secondaryLabel">
                  {CATEGORY_META[finding.category].title}
                </AppText>
                <AppText variant="headline">{finding.title}</AppText>
                <View style={styles.keepRow}>
                  <Thumb id={keeperId} />
                  <View style={styles.flex}>
                    <AppText variant="subhead">Keeping 1 photo</AppText>
                    <AppText variant="footnote" color="secondaryLabel">
                      {getMediaItem(keeperId).description}
                    </AppText>
                  </View>
                </View>
                <AppText variant="subhead">Removing {countLabel(removeIds.length, PHOTOS)}</AppText>
                <View style={styles.thumbs}>
                  {removeIds.map((id) => (
                    <Thumb key={id} id={id} showSize />
                  ))}
                </View>
              </View>
            ))}

            {plan.items.length > 0 ? (
              <View style={styles.section}>
                <AppText variant="headline">Single photos</AppText>
                {plan.items.map(({ finding }) => (
                  <View key={finding.id} style={styles.itemRow}>
                    <Thumb id={finding.assetId} />
                    <View style={styles.flex}>
                      <AppText variant="subhead">{CATEGORY_META[finding.category].title}</AppText>
                      <AppText variant="footnote" color="secondaryLabel">
                        {finding.reason} · {formatSize(getMediaItem(finding.assetId).bytes)}
                      </AppText>
                    </View>
                  </View>
                ))}
              </View>
            ) : null}
          </>
        )}
      </ScrollView>

      <View
        style={[
          styles.footer,
          { paddingBottom: insets.bottom + spacing.sm, borderTopColor: colors.separator },
        ]}
      >
        <ChromeBackground />
        <Button
          title={count > 0 ? `Remove ${countLabel(count, PHOTOS)}` : 'Remove photos'}
          variant="destructive"
          icon="warning"
          disabled
          block
          accessibilityHint="Not available for sample photos"
        />
        <AppText variant="footnote" color="secondaryLabel" style={styles.center}>
          Sample results can’t be removed. Removal arrives with real photo access, and will always
          ask iOS to confirm.
        </AppText>
      </View>
    </View>
  );
}

function Thumb({ id, showSize = false }: { id: string; showSize?: boolean }) {
  const { colors } = useTheme();
  const asset = getMediaItem(id);
  return (
    <View style={styles.thumbWrap}>
      <View
        style={[styles.thumb, { backgroundColor: colors.mediaPlaceholder }]}
        accessible
        accessibilityRole="image"
        accessibilityLabel={asset.description}
      >
        <MediaArtwork item={asset} glyphSize={20} />
      </View>
      {showSize ? (
        <AppText variant="caption" color="secondaryLabel" style={styles.numbers}>
          {formatSize(asset.bytes)}
        </AppText>
      ) : null}
    </View>
  );
}

const THUMB = 64;
/** Height the fixed footer covers, so the last rows can scroll above it. */
const FOOTER_CLEARANCE = 200;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: gutter,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xs,
  },
  content: { padding: gutter, gap: spacing.xl },
  summary: { gap: spacing.xs },
  numbers: { fontVariant: ['tabular-nums'] },
  warning: { gap: spacing.xs },
  warningRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  section: { gap: spacing.xs },
  keepRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  thumbs: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  thumbWrap: { gap: 2, alignItems: 'center' },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: radius.control,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: gutter,
    paddingTop: spacing.sm,
    gap: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  center: { textAlign: 'center' },
});
