import { Stack } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { ChromeBackground } from '@/components/chrome-background';
import { EmptyState } from '@/components/empty-state';
import { StatusPill } from '@/components/status-pill';
import { Surface } from '@/components/surface';
import { sampleBytes } from '@/demo/sample-library';
import { formatBytes } from '@/domain/bytes';
import {
  CATEGORY_ORDER,
  type FindingCategory,
  type GroupFinding,
  type ItemFinding,
} from '@/domain/findings';
import { createReviewSelection, type ReviewSelection } from '@/domain/review-selection';
import { CATEGORY_META } from '@/features/clean/category-meta';
import { useCleanSession } from '@/state/clean-session';
import { gutter, spacing, useTheme } from '@/theme';

import { GroupReview, toReviewGroup } from './group-review';
import { ItemReview } from './item-review';

export function isFindingCategory(value: unknown): value is FindingCategory {
  return typeof value === 'string' && (CATEGORY_ORDER as readonly string[]).includes(value);
}

/**
 * All findings in one category. Selections from every group feed one
 * running summary at the bottom. Selecting is a reversible review choice;
 * the removal plan arrives in P1-REV-004 and real removal in Phase 3.
 */
export function CategoryScreen({ category }: { category: FindingCategory }) {
  const { colors } = useTheme();
  const state = useCleanSession((session) => session.state);
  const meta = CATEGORY_META[category];
  const findings =
    state.status === 'results'
      ? state.findings.filter((finding) => finding.category === category)
      : [];
  const groups = findings.filter((finding): finding is GroupFinding => finding.kind === 'group');
  const items = findings.filter((finding): finding is ItemFinding => finding.kind === 'item');

  const [groupSelections, setGroupSelections] = useState<Record<string, ReviewSelection>>(() =>
    Object.fromEntries(
      groups.map((group) => [group.id, createReviewSelection(toReviewGroup(group))]),
    ),
  );
  const [itemSelection, setItemSelection] = useState<ReadonlySet<string>>(new Set());

  const selectedIds = new Set([
    ...Object.values(groupSelections).flatMap((selection) => [...selection.selectedIds]),
    ...itemSelection,
  ]);
  let selectedBytes = 0;
  for (const id of selectedIds) selectedBytes += sampleBytes(id);

  const toggleItem = (assetId: string) =>
    setItemSelection((current) => {
      const next = new Set(current);
      if (next.has(assetId)) next.delete(assetId);
      else next.add(assetId);
      return next;
    });

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: meta.title }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        style={styles.flex}
      >
        {findings.length === 0 ? (
          <Surface>
            <EmptyState
              icon={meta.icon}
              title="Nothing here yet"
              message="Show sample results on the Clean tab to explore this category."
            />
          </Surface>
        ) : (
          <>
            <View style={styles.intro}>
              <StatusPill label="Sample" tone="accent" icon="photo" />
              <AppText variant="body" color="secondaryLabel">
                {meta.description}
              </AppText>
            </View>
            {groups.map((group) => (
              <GroupReview
                key={group.id}
                group={group}
                selection={groupSelections[group.id]}
                onChange={(selection) =>
                  setGroupSelections((current) => ({ ...current, [group.id]: selection }))
                }
              />
            ))}
            {items.length > 0 ? (
              <ItemReview findings={items} selectedIds={itemSelection} onToggle={toggleItem} />
            ) : null}
          </>
        )}
      </ScrollView>
      {findings.length > 0 ? (
        <SelectionSummary count={selectedIds.size} bytes={selectedBytes} />
      ) : null}
    </View>
  );
}

function SelectionSummary({ count, bytes }: { count: number; bytes: number }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const text =
    count === 0
      ? 'Tap photos you might not need'
      : `${count} selected · ${formatBytes(bytes)} (sample sizes)`;

  return (
    <View
      style={[
        styles.summary,
        { paddingBottom: insets.bottom + spacing.sm, borderTopColor: colors.separator },
      ]}
    >
      <ChromeBackground />
      <AppText variant="headline" accessibilityLiveRegion="polite" style={styles.numbers}>
        {text}
      </AppText>
      <AppText variant="footnote" color="secondaryLabel">
        Nothing is removed from here. With real photos you’ll review the exact list first.
      </AppText>
    </View>
  );
}

/** Height the summary bar covers, so the last photos can scroll above it. */
const SUMMARY_CLEARANCE = 120;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    paddingHorizontal: gutter,
    paddingTop: spacing.sm,
    paddingBottom: SUMMARY_CLEARANCE + spacing.xxl,
    gap: spacing.xxl,
  },
  intro: { gap: spacing.sm },
  summary: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: gutter,
    paddingTop: spacing.sm,
    gap: 2,
    borderTopWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  numbers: { fontVariant: ['tabular-nums'] },
});
