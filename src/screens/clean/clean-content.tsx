import { router } from 'expo-router';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { Icon } from '@/components/icon';
import { SectionHeader } from '@/components/section-header';
import { StatusPill } from '@/components/status-pill';
import { Surface } from '@/components/surface';
import { sampleBytes } from '@/demo/sample-library';
import { formatBytes } from '@/domain/bytes';
import {
  summarizeCategories,
  totalReclaimableBytes,
  type ReviewAdjustments,
} from '@/domain/findings';
import { isActive, type Job } from '@/domain/jobs';
import type { CleanHomeState } from '@/state/clean-session';
import { gutter, radius, spacing, useTheme } from '@/theme';

import { CategoryCard } from './category-card';
import { ScanningCard, type ScanActions } from './scanning-card';

type CleanContentProps = {
  state: CleanHomeState;
  /** The current scan, if any. While it is active it replaces the content below. */
  job?: Job | null;
  onStartScan: () => void;
  onReset: () => void;
  scanActions?: ScanActions;
  /** Review choices (protected, skipped, keeper changes) that totals must respect. */
  adjustments?: ReviewAdjustments;
  /** Photos currently in the removal plan; shows a shortcut to it when > 0. */
  plannedCount?: number;
  onOpenPlan?: () => void;
};

const NO_SCAN_ACTIONS: ScanActions = { onPause: () => {}, onResume: () => {}, onStop: () => {} };

/**
 * Everything below the Clean title, driven only by props. Kept free of
 * stores so each state can be rendered in tests and in the dev gallery.
 */
export function CleanContent({
  state,
  job = null,
  onStartScan,
  onReset,
  scanActions = NO_SCAN_ACTIONS,
  adjustments = {},
  plannedCount = 0,
  onOpenPlan,
}: CleanContentProps) {
  if (isActive(job)) return <ScanningCard job={job} {...scanActions} />;

  switch (state.status) {
    case 'not-scanned':
      return <NotScanned onStartScan={onStartScan} />;
    case 'failed':
      return (
        <Surface>
          <EmptyState
            icon="warning"
            tone="error"
            title="Scan stopped"
            message={state.message}
            action={<Button title="Try again" variant="secondary" onPress={onStartScan} />}
          />
        </Surface>
      );
    case 'results':
      return (
        <Results
          state={state}
          adjustments={adjustments}
          onReset={onReset}
          plannedCount={plannedCount}
          onOpenPlan={onOpenPlan}
        />
      );
  }
}

function NotScanned({ onStartScan }: { onStartScan: () => void }) {
  const { colors } = useTheme();
  return (
    <Surface elevation="raised" style={styles.intro}>
      <StatusPill label="Not scanned" icon="info" />
      <AppText variant="title1">Keep the memories that matter.</AppText>
      <AppText variant="body" color="secondaryLabel">
        MediaCare finds repeat shots, copies and photos that didn’t turn out, then lets you decide
        what stays. Nothing is removed without your review.
      </AppText>
      <View style={[styles.notice, { backgroundColor: colors.surfaceRaised }]}>
        <Icon name="lock" size={16} color={colors.secondaryLabel} />
        <AppText variant="footnote" color="secondaryLabel" style={styles.flex}>
          This early build doesn’t ask for photo access. A simulated scan of sample images shows how
          it works.
        </AppText>
      </View>
      <Button title="Run sample scan" icon="scan" onPress={onStartScan} block />
    </Surface>
  );
}

function Results({
  state,
  adjustments,
  onReset,
  plannedCount,
  onOpenPlan,
}: {
  state: Extract<CleanHomeState, { status: 'results' }>;
  adjustments: ReviewAdjustments;
  onReset: () => void;
  plannedCount: number;
  onOpenPlan?: () => void;
}) {
  const { width } = useWindowDimensions();
  const summaries = summarizeCategories(state.findings, sampleBytes, adjustments);
  const total = totalReclaimableBytes(state.findings, sampleBytes, adjustments);
  const setAside = (adjustments.protectedIds?.size ?? 0) + (adjustments.skippedIds?.size ?? 0) > 0;
  const partial = state.analyzed < state.total;
  const cardWidth = Math.min(300, Math.round(width * 0.72));
  const coverage = partial
    ? `${state.analyzed.toLocaleString()} of ${state.total.toLocaleString()} sample photos checked so far`
    : `All ${state.total.toLocaleString()} sample photos checked`;

  if (summaries.length === 0) {
    return (
      <Surface>
        <EmptyState
          icon="check"
          title="Nothing to clean up"
          message={`None of the ${state.analyzed.toLocaleString()} photos checked are repeats, copies or unusually large.`}
          action={<Button title="Reset sample" variant="secondary" onPress={onReset} />}
        />
      </Surface>
    );
  }

  return (
    <>
      <Surface elevation="raised" style={styles.intro}>
        <View style={styles.pills}>
          <StatusPill label="Sample results" tone="accent" icon="photo" />
          {partial ? <StatusPill label="Partial" tone="warning" icon="warning" /> : null}
        </View>
        <AppText variant="title1" style={styles.numbers}>
          Could free up to {formatBytes(total)}
        </AppText>
        <AppText variant="body" color="secondaryLabel">
          {partial ? 'Results so far. Photos not checked yet aren’t included. ' : ''}
          Each photo is counted once
          {setAside ? ', protected photos and skipped groups aren’t counted' : ''}, and nothing is
          removed until you review it.
        </AppText>
        <AppText variant="footnote" color="secondaryLabel" style={styles.numbers}>
          {coverage}
        </AppText>
      </Surface>

      <View style={styles.section}>
        <SectionHeader eyebrow="Sample" title="Findings" />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          snapToInterval={cardWidth + spacing.sm}
          snapToAlignment="start"
          style={styles.shelf}
          contentContainerStyle={styles.shelfContent}
          accessibilityLabel="Finding categories"
        >
          {summaries.map((summary) => (
            <CategoryCard
              key={summary.category}
              summary={summary}
              width={cardWidth}
              onPress={() => router.push(`/category/${summary.category}`)}
            />
          ))}
        </ScrollView>
      </View>

      {plannedCount > 0 && onOpenPlan ? (
        <Surface style={styles.planRow}>
          <View style={styles.flex}>
            <AppText variant="headline">
              {plannedCount} {plannedCount === 1 ? 'photo' : 'photos'} marked
            </AppText>
            <AppText variant="footnote" color="secondaryLabel">
              See exactly what would be removed and kept.
            </AppText>
          </View>
          <Button title="Review plan" onPress={onOpenPlan} />
        </Surface>
      ) : null}

      <Button title="Reset sample" variant="plain" onPress={onReset} style={styles.reset} />
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  intro: { gap: spacing.sm, padding: spacing.lg },
  pills: { flexDirection: 'row', gap: spacing.xs },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: radius.control,
    marginVertical: spacing.xxs,
  },
  numbers: { fontVariant: ['tabular-nums'] },
  section: { gap: spacing.md },
  // The shelf bleeds to the screen edges while cards still align with the gutter.
  shelf: { marginHorizontal: -gutter },
  shelfContent: {
    paddingHorizontal: gutter,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  reset: { alignSelf: 'center' },
  planRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
