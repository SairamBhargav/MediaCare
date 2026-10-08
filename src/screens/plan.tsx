import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
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
import { runRemoval } from '@/features/clean/run-removal';
import { useActionPlan } from '@/features/clean/use-action-plan';
import { SKIP_TEXT, type SkipReason } from '@/domain/removal';
import type { RemovalResult } from '@/services/media/removal';
import { useCleanSession } from '@/state/clean-session';
import { usePreferences } from '@/state/preferences';
import { useReviewAdjustments } from '@/state/review-session';
import { haptics } from '@/utils/haptics';
import { gutter, radius, spacing, useTheme } from '@/theme';

const PHOTOS: [string, string] = ['photo', 'photos'];

/**
 * The removal plan: the exact photos that would be removed, what each group
 * keeps, an honest size, and what removal means on iOS (iCloud sync,
 * Recently Deleted). Sample data can't be removed. For real photos, Remove
 * works only after "Allow removing photos" is turned on in Settings; it
 * checks every photo again, then iOS asks for its own confirmation.
 */
export function PlanScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const plan = useActionPlan();
  const count = plan.assetIds.length;
  const state = useCleanSession((session) => session.state);
  const sample = state.status !== 'results' || state.sample;
  const allowRemoval = usePreferences((preferences) => preferences.allowRemoval);
  const adjustments = useReviewAdjustments();
  const [working, setWorking] = useState(false);
  const [result, setResult] = useState<RemovalResult | null>(null);
  const canRemove = !sample && allowRemoval && count > 0 && !working;

  const remove = async () => {
    setWorking(true);
    try {
      const outcome = await runRemoval(plan, adjustments.protectedIds ?? new Set());
      if (outcome.kind === 'done' && outcome.removedIds.length > 0) haptics.success();
      setResult(outcome);
    } catch (error) {
      setResult({
        kind: 'failed',
        check: { removeIds: [], skipped: [] },
        message: error instanceof Error ? error.message : 'Something went wrong.',
      });
    } finally {
      setWorking(false);
    }
  };

  const confirm = () =>
    Alert.alert(
      `Remove ${countLabel(count, PHOTOS)}?`,
      'MediaCare checks each photo again first and skips anything that changed. Then iOS asks you to confirm. Removed photos go to Recently Deleted in Photos, where you can restore them. If iCloud Photos is on, they are also removed from your other devices.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: () => {
            remove().catch(() => {});
          },
        },
      ],
    );

  if (result) return <RemovalReport result={result} />;

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
              <StatusPill label={sample ? 'Sample' : 'Your library'} tone="accent" icon="photo" />
              <AppText variant="title1" style={styles.numbers}>
                {countLabel(count, PHOTOS)}
              </AppText>
              <AppText variant="body" color="secondaryLabel" style={styles.numbers}>
                {sample
                  ? `Could free up to ${formatBytes(plan.bytes)} (sample sizes). `
                  : 'Sizes of your photos aren’t measured yet, so no space estimate is shown. '}
                The real space freed is only known after removal, and Photos keeps removed items for
                a while.
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
          title={
            working
              ? 'Checking…'
              : count > 0
                ? `Remove ${countLabel(count, PHOTOS)}`
                : 'Remove photos'
          }
          variant="destructive"
          icon="warning"
          disabled={!canRemove}
          loading={working}
          onPress={confirm}
          block
          accessibilityHint={
            sample
              ? 'Not available for sample photos'
              : allowRemoval
                ? 'Checks each photo again, then iOS asks you to confirm'
                : 'Turn on Allow removing photos in Settings first'
          }
        />
        <AppText variant="footnote" color="secondaryLabel" style={styles.center}>
          {sample
            ? 'Sample results can’t be removed.'
            : allowRemoval
              ? 'iOS always asks you to confirm. Removed photos go to Recently Deleted.'
              : 'Removing is off. Turn on “Allow removing photos” in Settings to use it.'}
        </AppText>
      </View>
    </View>
  );
}

function RemovalReport({ result }: { result: RemovalResult }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const skippedByReason = new Map<SkipReason, number>();
  for (const entry of result.check.skipped) {
    skippedByReason.set(entry.reason, (skippedByReason.get(entry.reason) ?? 0) + 1);
  }

  const title =
    result.kind === 'done'
      ? `Moved ${countLabel(result.removedIds.length, PHOTOS)} to Recently Deleted`
      : result.kind === 'canceled'
        ? 'Nothing was removed'
        : result.kind === 'nothing'
          ? 'Nothing was removed'
          : 'Removal didn’t finish';
  const message =
    result.kind === 'done'
      ? 'You can restore them from the Recently Deleted album in Photos until Photos empties it.'
      : result.kind === 'canceled'
        ? 'You chose not to allow it when iOS asked. Your photos are unchanged.'
        : result.kind === 'nothing'
          ? 'Every marked photo changed or was protected since you reviewed it, so none were sent to iOS.'
          : `${result.message} Your photos weren’t removed.`;

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <AppText variant="title2">Removal plan</AppText>
        <Button title="Done" variant="plain" onPress={() => router.back()} />
      </View>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
      >
        <Surface style={styles.summary}>
          <EmptyState
            icon={result.kind === 'done' ? 'check' : result.kind === 'failed' ? 'warning' : 'info'}
            tone={result.kind === 'failed' ? 'error' : 'neutral'}
            title={title}
            message={message}
          />
          {result.kind === 'done' && result.stillThereIds.length > 0 ? (
            <AppText variant="footnote" color="secondaryLabel">
              {countLabel(result.stillThereIds.length, PHOTOS)} were still in Photos afterwards, so
              they aren’t counted as removed.
            </AppText>
          ) : null}
          {skippedByReason.size > 0 ? (
            <View style={styles.section}>
              <AppText variant="headline">Skipped</AppText>
              {[...skippedByReason.entries()].map(([reason, n]) => (
                <AppText key={reason} variant="subhead" color="secondaryLabel">
                  {n} · {SKIP_TEXT[reason]}
                </AppText>
              ))}
            </View>
          ) : null}
        </Surface>
      </ScrollView>
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
