import { useState } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { MediaTile } from '@/components/media-tile';
import { SectionHeader } from '@/components/section-header';
import { Surface } from '@/components/surface';
import { getSampleAsset, sampleSimilarGroup } from '@/demo/sample-library';
import { formatBytes, sumUniqueBytes } from '@/domain/bytes';
import {
  clearSelection,
  createReviewSelection,
  selectAllExceptKeeper,
  toggleSelected,
  type ReviewGroup,
} from '@/domain/review-selection';
import { spacing, useTheme } from '@/theme';

const group: ReviewGroup = {
  memberIds: sampleSimilarGroup.memberIds,
  keeperId: sampleSimilarGroup.keeperId,
  protectedIds: new Set(),
};

/**
 * A sample "similar shots" group. Demonstrates the review interaction (keeper,
 * selection, running summary) with synthetic images. Selection here is a
 * reversible review choice; there is no removal path in Phase 0.
 */
export function SampleReview() {
  const { colors } = useTheme();
  const [selection, setSelection] = useState(() => createReviewSelection(group));
  const members = group.memberIds.map(getSampleAsset);
  const selectableCount = members.length - 1;
  const selectedAssets = members.filter((asset) => selection.selectedIds.has(asset.id));
  const allSelected = selectedAssets.length === selectableCount;
  const selectedBytes = sumUniqueBytes(selectedAssets);

  const summary =
    selectedAssets.length === 0
      ? 'Tap photos you might not need'
      : `${selectedAssets.length} of ${selectableCount} selected · ${formatBytes(selectedBytes)}`;

  return (
    <View style={styles.section}>
      <SectionHeader
        eyebrow="Sample · Similar shots"
        title={sampleSimilarGroup.title}
        action={
          <Button
            title={allSelected ? 'Clear' : 'Select all'}
            variant="plain"
            onPress={() => {
              const next = allSelected
                ? clearSelection(selection)
                : selectAllExceptKeeper(group, selection);
              setSelection(next);
              AccessibilityInfo.announceForAccessibility(
                allSelected ? 'Selection cleared' : `${selectableCount} photos selected`,
              );
            }}
          />
        }
      />

      <View style={styles.reason}>
        <Icon name="star" size={14} color={colors.accent} />
        <AppText variant="subhead" color="secondaryLabel" style={styles.reasonText}>
          Suggested keeper: {sampleSimilarGroup.keeperReason.toLowerCase()}.
        </AppText>
      </View>

      <View style={styles.grid}>
        {members.map((asset) => {
          const isKeeper = asset.id === selection.keeperId;
          return (
            <View key={asset.id} style={styles.cell}>
              <MediaTile
                asset={asset}
                appearance="card"
                keeper={isKeeper}
                selectable
                selected={selection.selectedIds.has(asset.id)}
                onPress={
                  isKeeper
                    ? undefined
                    : () => setSelection((current) => toggleSelected(group, current, asset.id))
                }
              />
            </View>
          );
        })}
      </View>

      <Surface style={styles.summary}>
        <AppText variant="headline" accessibilityLiveRegion="polite" style={styles.summaryText}>
          {summary}
        </AppText>
        <AppText variant="footnote" color="secondaryLabel">
          Sample sizes are illustrative. With real photos, MediaCare will show the exact items and
          bytes before anything is removed, and removal will always need your confirmation.
        </AppText>
      </Surface>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.md },
  reason: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  reasonText: { flex: 1 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  cell: {
    // Two columns with one gap between them.
    width: `${(100 - 4) / 2}%`,
    flexGrow: 1,
  },
  summary: { gap: spacing.xxs },
  summaryText: { fontVariant: ['tabular-nums'] },
});
