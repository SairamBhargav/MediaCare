import { router } from 'expo-router';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { Icon } from '@/components/icon';
import { RevealGroup } from '@/components/reveal';
import { SectionHeader } from '@/components/section-header';
import { StatusPill } from '@/components/status-pill';
import { Surface } from '@/components/surface';
import { formatBytes } from '@/domain/bytes';
import {
  candidateCount,
  summarizeCategories,
  totalReclaimableBytes,
  type ReviewAdjustments,
} from '@/domain/findings';
import { isActive, type Job } from '@/domain/jobs';
import { knownBytes } from '@/features/media/registry';
import type { PhotoAccess } from '@/services/media/photo-library';
import type { CleanHomeState } from '@/state/clean-session';
import { gutter, radius, spacing, useTheme } from '@/theme';

import { CategoryCard } from './category-card';
import { CopiesCard, type CopyCheckSummary } from './copies-card';
import { ScanningCard, type ScanActions } from './scanning-card';

export type CleanActions = {
  /** Real scan of the Photos library (asks for access first if needed). */
  onScanLibrary: () => void;
  onSampleScan: () => void;
  onManageSelection: () => void;
  onOpenSettings: () => void;
  onReset: () => void;
  onOpenPlan?: () => void;
  /** Starts "Find exact copies" (real results only). */
  onFindCopies?: () => void;
};

type CleanContentProps = {
  state: CleanHomeState;
  /** Current photo access. `unknown` until checked. */
  access: PhotoAccess | 'unknown';
  /** The current scan, if any. While it is active it replaces the content below. */
  job?: Job | null;
  actions: CleanActions;
  scanActions?: ScanActions;
  /** Review choices (protected, skipped, keeper changes) that totals must respect. */
  adjustments?: ReviewAdjustments;
  /** Photos currently in the removal plan; shows a shortcut to it when > 0. */
  plannedCount?: number;
  /** Photos reported changes since the last scan. */
  libraryChanged?: boolean;
  /** Play the one-time staggered reveal (P1-MOT-001) as this content mounts. */
  animateReveal?: boolean;
  /** What the exact copies check covered (real results only). */
  copyCheck?: CopyCheckSummary;
};

const NO_SCAN_ACTIONS: ScanActions = { onPause: () => {}, onResume: () => {}, onStop: () => {} };

/**
 * Everything below the Clean title, driven only by props. Kept free of
 * stores so each state can be rendered in tests and in the dev gallery.
 */
export function CleanContent({
  state,
  access,
  job = null,
  actions,
  scanActions = NO_SCAN_ACTIONS,
  adjustments = {},
  plannedCount = 0,
  libraryChanged = false,
  animateReveal = false,
  copyCheck,
}: CleanContentProps) {
  if (isActive(job)) {
    return (
      <RevealGroup index={0} animate={animateReveal}>
        <ScanningCard job={job} {...scanActions} />
      </RevealGroup>
    );
  }

  switch (state.status) {
    case 'not-scanned':
      return (
        <RevealGroup index={0} animate={animateReveal}>
          <NotScanned access={access} actions={actions} />
        </RevealGroup>
      );
    case 'failed':
      return (
        <RevealGroup index={0} animate={animateReveal}>
          <Surface>
            <EmptyState
              icon="warning"
              tone="error"
              title="Scan stopped"
              message={state.message}
              action={
                <Button title="Try again" variant="secondary" onPress={actions.onScanLibrary} />
              }
            />
          </Surface>
        </RevealGroup>
      );
    case 'results':
      return (
        <Results
          state={state}
          access={access}
          actions={actions}
          adjustments={adjustments}
          plannedCount={plannedCount}
          libraryChanged={libraryChanged}
          animateReveal={animateReveal}
          copyCheck={copyCheck}
        />
      );
  }
}

function Notice({ icon, children }: { icon: 'lock' | 'info' | 'warning'; children: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.notice, { backgroundColor: colors.surfaceRaised }]}>
      <Icon name={icon} size={16} color={colors.secondaryLabel} />
      <AppText variant="footnote" color="secondaryLabel" style={styles.flex}>
        {children}
      </AppText>
    </View>
  );
}

function NotScanned({
  access,
  actions,
}: {
  access: PhotoAccess | 'unknown';
  actions: CleanActions;
}) {
  return (
    <Surface elevation="raised" style={styles.intro}>
      <StatusPill label="Not scanned" icon="info" />
      <AppText variant="title1">Keep the memories that matter.</AppText>
      <AppText variant="body" color="secondaryLabel">
        MediaCare finds bursts, screenshots and long videos, then lets you decide what stays.
        Nothing is removed without your review.
      </AppText>

      {access === 'denied' ? (
        <>
          <Notice icon="warning">
            MediaCare doesn’t have access to your photos. You can turn it on in Settings, under
            Photos.
          </Notice>
          <Button title="Open Settings" icon="settings" onPress={actions.onOpenSettings} block />
        </>
      ) : (
        <>
          <Notice icon="lock">
            Your photos are checked on this iPhone. Nothing is uploaded, and scanning reads only
            dates, sizes and types, not the pictures themselves.
          </Notice>
          <Button
            title={access === 'limited' ? 'Scan selected photos' : 'Scan my library'}
            icon="scan"
            onPress={actions.onScanLibrary}
            block
            accessibilityHint={
              access === 'full' || access === 'limited'
                ? undefined
                : 'Explains photo access, then iOS asks'
            }
          />
          {access === 'limited' ? (
            <Button
              title="Manage selected photos"
              variant="plain"
              onPress={actions.onManageSelection}
            />
          ) : null}
        </>
      )}
      <Button
        title="Try with sample photos"
        variant="secondary"
        onPress={actions.onSampleScan}
        block
      />
    </Surface>
  );
}

function Results({
  state,
  access,
  actions,
  adjustments,
  plannedCount,
  libraryChanged,
  animateReveal,
  copyCheck,
}: {
  state: Extract<CleanHomeState, { status: 'results' }>;
  access: PhotoAccess | 'unknown';
  actions: CleanActions;
  adjustments: ReviewAdjustments;
  plannedCount: number;
  libraryChanged: boolean;
  animateReveal: boolean;
  copyCheck?: CopyCheckSummary;
}) {
  const { width } = useWindowDimensions();
  const sample = state.sample;
  const summaries = summarizeCategories(state.findings, knownBytes, adjustments);
  const totalBytes = totalReclaimableBytes(state.findings, knownBytes, adjustments);
  const candidates = candidateCount(state.findings, adjustments);
  const setAside = (adjustments.protectedIds?.size ?? 0) + (adjustments.skippedIds?.size ?? 0) > 0;
  const partial = state.analyzed < state.total;
  const cardWidth = Math.min(300, Math.round(width * 0.72));
  const noun = sample ? 'sample photos' : 'photos and videos';
  const coverage = partial
    ? `${state.analyzed.toLocaleString()} of ${state.total.toLocaleString()} ${noun} checked so far`
    : `All ${state.total.toLocaleString()} ${noun} checked`;

  const footer = sample ? (
    <Button title="Reset sample" variant="plain" onPress={actions.onReset} style={styles.center} />
  ) : (
    <>
      {copyCheck && actions.onFindCopies ? (
        <CopiesCard summary={copyCheck} onStart={actions.onFindCopies} />
      ) : null}
      <Button
        title="Scan again"
        variant="plain"
        onPress={actions.onScanLibrary}
        style={styles.center}
      />
    </>
  );

  const changedBanner =
    !sample && libraryChanged ? (
      <Surface style={styles.row}>
        <View style={styles.flex}>
          <AppText variant="headline">Photos changed</AppText>
          <AppText variant="footnote" color="secondaryLabel">
            Your library changed since this scan.
          </AppText>
        </View>
        <Button title="Scan again" onPress={actions.onScanLibrary} />
      </Surface>
    ) : null;

  if (summaries.length === 0) {
    return (
      <>
        <RevealGroup index={0} animate={animateReveal}>
          {changedBanner}
          <Surface>
            <EmptyState
              icon="check"
              title="Nothing to clean up"
              message={
                sample
                  ? `None of the ${state.analyzed.toLocaleString()} photos checked are repeats, copies or unusually large.`
                  : `No bursts, screenshots or long videos among the ${state.analyzed.toLocaleString()} items checked.`
              }
            />
          </Surface>
        </RevealGroup>
        <RevealGroup index={1} animate={animateReveal}>
          {footer}
        </RevealGroup>
      </>
    );
  }

  return (
    <>
      <RevealGroup index={0} animate={animateReveal}>
        {changedBanner}
        <Surface elevation="raised" style={styles.intro}>
          <View style={styles.pills}>
            <StatusPill
              label={sample ? 'Sample results' : 'Your library'}
              tone="accent"
              icon="photo"
            />
            {partial ? <StatusPill label="Partial" tone="warning" icon="warning" /> : null}
          </View>
          <AppText variant="title1" style={styles.numbers}>
            {sample
              ? `Could free up to ${formatBytes(totalBytes)}`
              : `${candidates.toLocaleString()} ${candidates === 1 ? 'item' : 'items'} to review`}
          </AppText>
          <AppText variant="body" color="secondaryLabel">
            {partial ? 'Results so far. Items not checked yet aren’t included. ' : ''}
            {sample
              ? 'Each photo is counted once'
              : 'Favorites aren’t suggested, sizes aren’t measured yet'}
            {setAside ? ', protected photos and skipped groups aren’t counted' : ''}, and nothing is
            removed until you review it.
          </AppText>
          <AppText variant="footnote" color="secondaryLabel" style={styles.numbers}>
            {coverage}
          </AppText>
          {!sample && access === 'limited' ? (
            <View style={styles.row}>
              <AppText variant="footnote" color="secondaryLabel" style={styles.flex}>
                Only the photos you’ve shared with MediaCare are included.
              </AppText>
              <Button title="Manage" variant="plain" onPress={actions.onManageSelection} />
            </View>
          ) : null}
        </Surface>
      </RevealGroup>

      <RevealGroup index={1} animate={animateReveal}>
        <View style={styles.section}>
          <SectionHeader eyebrow={sample ? 'Sample' : 'Your library'} title="Findings" />
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
                sample={sample}
                width={cardWidth}
                onPress={() => router.push(`/category/${summary.category}`)}
              />
            ))}
          </ScrollView>
        </View>
      </RevealGroup>

      {plannedCount > 0 && actions.onOpenPlan ? (
        <RevealGroup index={2} animate={animateReveal}>
          <Surface style={styles.row}>
            <View style={styles.flex}>
              <AppText variant="headline">
                {plannedCount} {plannedCount === 1 ? 'photo' : 'photos'} marked
              </AppText>
              <AppText variant="footnote" color="secondaryLabel">
                See exactly what would be removed and kept.
              </AppText>
            </View>
            <Button title="Review plan" onPress={actions.onOpenPlan} />
          </Surface>
        </RevealGroup>
      ) : null}

      <RevealGroup index={3} animate={animateReveal}>
        {footer}
      </RevealGroup>
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
  center: { alignSelf: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
