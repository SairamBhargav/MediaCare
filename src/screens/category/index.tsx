import { Stack, router } from 'expo-router';
import { useMemo } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { ChromeBackground } from '@/components/chrome-background';
import { EmptyState } from '@/components/empty-state';
import { StatusPill } from '@/components/status-pill';
import { Surface } from '@/components/surface';
import { knownBytes } from '@/features/media/registry';
import { formatBytes } from '@/domain/bytes';
import {
  CATEGORY_ORDER,
  type FindingCategory,
  type GroupFinding,
  type ItemFinding,
} from '@/domain/findings';
import { chunkRows } from '@/domain/timeline';
import { CATEGORY_META } from '@/features/clean/category-meta';
import { useCleanSession } from '@/state/clean-session';
import { selectionFor, useReviewSession } from '@/state/review-session';
import { gutter, spacing, useTheme } from '@/theme';

import { GroupReview } from './group-review';
import { ItemHint, ItemRow } from './item-review';

export function isFindingCategory(value: unknown): value is FindingCategory {
  return typeof value === 'string' && (CATEGORY_ORDER as readonly string[]).includes(value);
}

/**
 * All findings in one category. Selections from every group feed one
 * running summary at the bottom. Review choices live in the review session,
 * so leaving and coming back keeps them. Selecting is a reversible review
 * choice; the removal plan arrives in P1-REV-004 and real removal in Phase 3.
 */
export function CategoryScreen({ category }: { category: FindingCategory }) {
  const { colors } = useTheme();
  const state = useCleanSession((session) => session.state);
  const meta = CATEGORY_META[category];
  // Real results never borrow the sample labels or sample sizes.
  const sample = state.status === 'results' && state.sample;
  const allFindings = state.status === 'results' ? state.findings : null;

  // Recomputed only when the results change, not on every selection tap.
  // Groups are one row each; single photos go two to a row.
  const { findings, groups, items, rows } = useMemo(() => {
    const inCategory = (allFindings ?? []).filter((finding) => finding.category === category);
    const groupList = inCategory.filter(
      (finding): finding is GroupFinding => finding.kind === 'group',
    );
    const itemList = inCategory.filter(
      (finding): finding is ItemFinding => finding.kind === 'item',
    );
    return {
      findings: inCategory,
      groups: groupList,
      items: itemList,
      rows: [
        ...groupList.map((group): Row => ({ kind: 'group', key: group.id, group })),
        ...chunkRows(itemList, 2).map((pair): Row => ({
          kind: 'items',
          key: pair[0].id,
          findings: pair,
        })),
      ],
    };
  }, [allFindings, category]);

  if (findings.length === 0) {
    return (
      <View style={[styles.flex, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ title: meta.title }} />
        <View style={styles.content}>
          <Surface>
            <EmptyState
              icon={meta.icon}
              title="Nothing here yet"
              message={
                state.status === 'results' && !state.sample
                  ? 'Nothing in this category in your library right now.'
                  : 'Show sample results on the Clean tab to explore this category.'
              }
            />
          </Surface>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: meta.title }} />
      {/* Virtualized: only groups near the screen are drawn, so big categories open fast. */}
      <FlatList
        data={rows}
        keyExtractor={(row) => row.key}
        renderItem={({ item: row }) =>
          row.kind === 'group' ? (
            <GroupReview group={row.group} />
          ) : (
            <ItemRow findings={row.findings} />
          )
        }
        ItemSeparatorComponent={() => (
          <View style={groups.length > 0 ? styles.groupGap : styles.itemGap} />
        )}
        ListHeaderComponent={
          <View style={styles.intro}>
            <StatusPill label={sample ? 'Sample' : 'Your library'} tone="accent" icon="photo" />
            <AppText variant="body" color="secondaryLabel">
              {meta.description}
            </AppText>
          </View>
        }
        ListFooterComponent={items.length > 0 ? <ItemHint /> : null}
        ListFooterComponentStyle={styles.footer}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        initialNumToRender={groups.length > 0 ? 3 : 6}
        maxToRenderPerBatch={4}
        windowSize={7}
        style={styles.flex}
      />
      <SelectionSummary groups={groups} items={items} sample={sample} />
    </View>
  );
}

type Row =
  | { kind: 'group'; key: string; group: GroupFinding }
  | { kind: 'items'; key: string; findings: ItemFinding[] };

/**
 * The running total at the bottom. It alone listens to every choice in the
 * category, so a tap redraws this bar and the photo tapped, nothing else.
 */
function SelectionSummary({
  groups,
  items,
  sample,
}: {
  groups: readonly GroupFinding[];
  items: readonly ItemFinding[];
  sample: boolean;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const selections = useReviewSession((state) => state.selections);
  const protectedIds = useReviewSession((state) => state.protectedIds);
  const itemSelectedIds = useReviewSession((state) => state.itemSelectedIds);

  // Only this category's choices count toward its summary.
  const selectedIds = new Set([
    ...groups.flatMap((group) => [
      ...selectionFor(group, { selections, protectedIds }).selectedIds,
    ]),
    ...items.map((item) => item.assetId).filter((id) => itemSelectedIds.has(id)),
  ]);
  let bytes = 0;
  for (const id of selectedIds) bytes += knownBytes(id);
  const count = selectedIds.size;
  const text =
    count === 0
      ? 'Tap photos you might not need'
      : sample
        ? `${count} selected · ${formatBytes(bytes)} (sample sizes)`
        : `${count} selected`;

  return (
    <View
      style={[
        styles.summary,
        { paddingBottom: insets.bottom + spacing.sm, borderTopColor: colors.separator },
      ]}
    >
      <ChromeBackground />
      <View style={styles.summaryRow}>
        <View style={styles.flex}>
          <AppText variant="headline" accessibilityLiveRegion="polite" style={styles.numbers}>
            {text}
          </AppText>
          <AppText variant="footnote" color="secondaryLabel">
            Nothing is removed from here.
          </AppText>
        </View>
        {count > 0 ? (
          <Button
            title="Review plan"
            onPress={() => router.push('/plan')}
            accessibilityHint="Lists exactly what would be removed and kept"
          />
        ) : null}
      </View>
    </View>
  );
}

/** Height the summary bar covers, so the last photos can scroll above it. */
const SUMMARY_CLEARANCE = 120;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  content: {
    paddingHorizontal: gutter,
    paddingTop: spacing.sm,
    paddingBottom: SUMMARY_CLEARANCE + spacing.xxl,
  },
  intro: { gap: spacing.sm, marginBottom: spacing.xxl },
  groupGap: { height: spacing.xxl },
  itemGap: { height: spacing.lg },
  footer: { marginTop: spacing.md },
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
