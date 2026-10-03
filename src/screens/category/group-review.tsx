import { AccessibilityInfo, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { MediaTile } from '@/components/media-tile';
import { SectionHeader } from '@/components/section-header';
import { getSampleAsset } from '@/demo/sample-library';
import type { GroupFinding } from '@/domain/findings';
import {
  clearSelection,
  selectAllExceptKeeper,
  toggleSelected,
  type ReviewGroup,
  type ReviewSelection,
} from '@/domain/review-selection';
import { CATEGORY_META } from '@/features/clean/category-meta';
import { spacing, useTheme } from '@/theme';

type GroupReviewProps = {
  group: GroupFinding;
  selection: ReviewSelection;
  onChange: (selection: ReviewSelection) => void;
};

export function toReviewGroup(group: GroupFinding): ReviewGroup {
  return { memberIds: group.memberIds, keeperId: group.keeperId, protectedIds: new Set() };
}

/**
 * One group of similar shots or exact copies: suggested keeper with its
 * reason, selectable members, Select all / Clear. Selection is a reversible
 * review choice owned by the parent; nothing here removes anything.
 */
export function GroupReview({ group, selection, onChange }: GroupReviewProps) {
  const { colors } = useTheme();
  const reviewGroup = toReviewGroup(group);
  const members = group.memberIds.map(getSampleAsset);
  const selectableCount = members.length - 1;
  const allSelected = selection.selectedIds.size === selectableCount;

  return (
    <View style={styles.section}>
      <SectionHeader
        eyebrow={`Sample · ${CATEGORY_META[group.category].title} · ${members.length} photos`}
        title={group.title}
        action={
          <Button
            title={allSelected ? 'Clear' : 'Select all'}
            variant="plain"
            accessibilityHint={`For ${group.title}`}
            onPress={() => {
              onChange(
                allSelected
                  ? clearSelection(selection)
                  : selectAllExceptKeeper(reviewGroup, selection),
              );
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
          Suggested keeper: {group.keeperReason.toLowerCase()}.
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
                    : () => onChange(toggleSelected(reviewGroup, selection, asset.id))
                }
              />
            </View>
          );
        })}
      </View>
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
  // Two columns. No flexGrow: an odd last photo keeps its size instead of stretching.
  cell: { width: '48%' },
});
