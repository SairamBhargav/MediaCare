import { router } from 'expo-router';
import { memo } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { MediaTile } from '@/components/media-tile';
import { SectionHeader } from '@/components/section-header';
import { Surface } from '@/components/surface';
import { getMediaItem, isSample } from '@/features/media/registry';
import type { GroupFinding } from '@/domain/findings';
import { canSelect, clearSelection, selectRest, toggleSelected } from '@/domain/review-selection';
import { CATEGORY_META } from '@/features/clean/category-meta';
import { selectionFor, toReviewGroup, useReviewSession } from '@/state/review-session';
import { spacing, useTheme } from '@/theme';
import type { PhotoAction } from '@/utils/photo-actions';

/**
 * One group of similar shots or exact copies. Shows the keeper in effect
 * (the suggestion, or the user's choice) with its reason, selectable
 * members, Select all / Clear and Skip. Long-press a photo (or use a
 * VoiceOver action) to keep it instead or to protect it. Every choice is
 * reversible and kept for the session; nothing here removes anything.
 */
export const GroupReview = memo(function GroupReview({ group }: { group: GroupFinding }) {
  const { colors } = useTheme();
  // Narrow subscriptions: a choice in another group doesn't redraw this one.
  const stored = useReviewSession((state) => state.selections[group.id]);
  const protectedIds = useReviewSession((state) => state.protectedIds);
  const skipped = useReviewSession((state) => state.skippedIds.has(group.id));
  const review = useReviewSession.getState();
  const reviewGroup = toReviewGroup(group, { protectedIds });
  const selection = selectionFor(group, {
    selections: stored ? { [group.id]: stored } : {},
    protectedIds,
  });
  const members = group.memberIds.map(getMediaItem);
  const selectableIds = group.memberIds.filter((id) => canSelect(reviewGroup, selection, id));
  // Only while the suggested keeper stands: a keeper the person chose resets the suggestion.
  const alsoKeepIds = selection.keeperId === group.keeperId ? (group.alsoKeepIds ?? []) : [];
  const restIds = selectableIds.filter((id) => !alsoKeepIds.includes(id));
  const allSelected = restIds.length > 0 && restIds.every((id) => selection.selectedIds.has(id));
  const bulkLabel = alsoKeepIds.length > 0 ? 'Mark the rest' : 'Select all';
  const userKeeper = selection.keeperId !== group.keeperId;
  const eyebrow = `${members.some(isSample) ? 'Sample · ' : ''}${CATEGORY_META[group.category].title} · ${members.length} photos`;

  if (skipped) {
    return (
      <Surface style={styles.skipped}>
        <View style={styles.flex}>
          <AppText variant="eyebrow" color="secondaryLabel">
            {eyebrow}
          </AppText>
          <AppText variant="headline">{group.title}</AppText>
          <AppText variant="subhead" color="secondaryLabel">
            Skipped. These photos won’t be counted or suggested.
          </AppText>
        </View>
        <Button
          title="Undo"
          variant="plain"
          accessibilityHint={`Brings back ${group.title}`}
          onPress={() => review.unskip(group.id)}
        />
      </Surface>
    );
  }

  const actionsFor = (assetId: string): PhotoAction[] => {
    const actions: PhotoAction[] = [];
    if (assetId !== selection.keeperId) {
      actions.push({
        label: 'Keep this one instead',
        onPress: () => {
          review.setGroupKeeper(group, assetId);
          AccessibilityInfo.announceForAccessibility('Keeper changed');
        },
      });
    }
    const isProtected = protectedIds.has(assetId);
    actions.push({
      label: isProtected ? 'Unprotect' : 'Protect',
      onPress: () => review.toggleProtected(assetId),
    });
    return actions;
  };

  return (
    <View style={styles.section}>
      <SectionHeader
        eyebrow={eyebrow}
        title={group.title}
        action={
          <View style={styles.headerActions}>
            <Button
              title="Skip"
              variant="plain"
              accessibilityHint={`Sets ${group.title} aside without changing anything`}
              onPress={() => {
                review.skip(group.id);
                AccessibilityInfo.announceForAccessibility(`${group.title} skipped`);
              }}
            />
            {restIds.length > 0 ? (
              <Button
                title={allSelected ? 'Clear' : bulkLabel}
                variant="plain"
                accessibilityHint={`For ${group.title}`}
                onPress={() => {
                  review.setGroupSelection(
                    group.id,
                    allSelected
                      ? clearSelection(selection)
                      : selectRest(reviewGroup, selection, alsoKeepIds),
                  );
                  AccessibilityInfo.announceForAccessibility(
                    allSelected ? 'Selection cleared' : `${restIds.length} photos marked`,
                  );
                }}
              />
            ) : null}
          </View>
        }
      />

      <View style={styles.reason}>
        <Icon name="star" size={14} color={colors.accent} />
        <AppText variant="subhead" color="secondaryLabel" style={styles.flex}>
          {userKeeper
            ? 'You chose the keeper for this group.'
            : `Suggested keeper: ${group.keeperReason.toLowerCase()}.`}
          {alsoKeepIds.length > 0 && group.alsoKeepReason
            ? ` Also good: ${group.alsoKeepReason.toLowerCase()}, so you keep the best two.`
            : ''}
        </AppText>
      </View>

      <View style={styles.grid}>
        {members.map((asset) => {
          const isKeeper = asset.id === selection.keeperId;
          const isProtected = protectedIds.has(asset.id);
          return (
            <View key={asset.id} style={styles.cell}>
              <MediaTile
                asset={asset}
                appearance="card"
                keeper={isKeeper}
                alsoGood={alsoKeepIds.includes(asset.id)}
                isProtected={isProtected}
                selectable
                selected={selection.selectedIds.has(asset.id)}
                actions={actionsFor(asset.id)}
                onPress={
                  isKeeper || isProtected
                    ? undefined
                    : () =>
                        review.setGroupSelection(
                          group.id,
                          toggleSelected(reviewGroup, selection, asset.id),
                        )
                }
              />
            </View>
          );
        })}
      </View>
      <View style={styles.footer}>
        <AppText variant="footnote" color="secondaryLabel" style={styles.flex}>
          Touch and hold a photo to keep it instead or to protect it.
        </AppText>
        <Button
          title="Compare"
          icon="compare"
          variant="secondary"
          accessibilityHint={`Opens ${group.title} full screen`}
          // Real group ids contain ph:// identifiers with slashes; escape them.
          onPress={() => router.push(`/review/${encodeURIComponent(group.id)}`)}
        />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  section: { gap: spacing.md },
  headerActions: { flexDirection: 'row' },
  reason: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  flex: { flex: 1, gap: 2 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  // Two columns. No flexGrow: an odd last photo keeps its size instead of stretching.
  cell: { width: '48%' },
  footer: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  skipped: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
