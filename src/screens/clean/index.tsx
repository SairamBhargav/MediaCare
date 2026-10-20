import { router, useIsFocused } from 'expo-router';
import { useEffect } from 'react';

import { IconButton } from '@/components/icon-button';
import { useSessionReveal } from '@/components/reveal';
import { Screen } from '@/components/screen';
import { TourAnchor } from '@/components/tour-anchor';
import { copyCoverage } from '@/domain/exact-copies';
import { cloudNote } from '@/domain/icloud';
import { visualCoverage } from '@/domain/visual-records';
import { useActionPlan } from '@/features/clean/use-action-plan';
import { scanLibrary } from '@/features/media/start-scan';
import { openSettings } from '@/services/media/photo-library';
import {
  ANALYSIS_IMPLEMENTATION,
  activeCopyMethod,
  cloudDownloadAvailable,
  visualAnalysisAvailable,
} from '@/services/media/visual-analysis';
import { useCatalog } from '@/state/catalog';
import { useCleanSession } from '@/state/clean-session';
import { usePreferences } from '@/state/preferences';
import { useReviewAdjustments } from '@/state/review-session';
import { useTour } from '@/state/tour';

import { CleanContent } from './clean-content';

/**
 * Starts the guided tour once for a new user: after the introduction and
 * the photo-access explanation have closed and Clean is actually on screen
 * (nothing presented over it).
 */
function useFirstRunTour(focused: boolean) {
  const onboardingSeen = usePreferences((preferences) => preferences.onboardingSeen);
  const tourSeen = usePreferences((preferences) => preferences.tourSeen);
  useEffect(() => {
    if (!focused || !onboardingSeen || tourSeen || useTour.getState().active) return;
    const timer = setTimeout(() => useTour.getState().start(), 900);
    return () => clearTimeout(timer);
  }, [focused, onboardingSeen, tourSeen]);
}

export function CleanScreen() {
  const state = useCleanSession((session) => session.state);
  const job = useCleanSession((session) => session.job);
  const access = useCatalog((catalog) => catalog.access);
  const libraryChanged = useCatalog((catalog) => catalog.libraryChanged);
  const items = useCatalog((catalog) => catalog.items);
  const fingerprints = useCatalog((catalog) => catalog.fingerprints);
  const copySets = useCatalog((catalog) => catalog.copySets);
  const lastCopyCheck = useCatalog((catalog) => catalog.lastCopyCheck);
  const visualRows = useCatalog((catalog) => catalog.visualRows);
  const lastAnalysis = useCatalog((catalog) => catalog.lastAnalysis);
  const cloudBlocked = useCleanSession((session) => session.cloudBlocked);
  const includeICloud = usePreferences((preferences) => preferences.includeICloud);
  const icloudOnMobileData = usePreferences((preferences) => preferences.icloudOnMobileData);
  const cloudSettings = {
    available: cloudDownloadAvailable(),
    enabled: includeICloud,
    allowMobileData: icloudOnMobileData,
  };
  const visual = visualCoverage(items, visualRows, ANALYSIS_IMPLEMENTATION);
  const analysis = {
    available: visualAnalysisAvailable(),
    coverage: visual,
    lastStatus: lastAnalysis?.status ?? null,
    icloud: cloudNote({
      ...cloudSettings,
      inCloud: visual.notAnalyzed.find((entry) => entry.reason === 'in-icloud')?.count ?? 0,
      blocked: cloudBlocked.analysis,
    }),
  };
  const copies = copyCoverage(items, fingerprints, copySets, activeCopyMethod());
  const copyCheck = {
    coverage: copies,
    lastStatus: lastCopyCheck?.status ?? null,
    sets: copySets.length,
    icloud: cloudNote({
      ...cloudSettings,
      // "unavailable" is iCloud-only or unreadable; the app build can't tell them apart.
      inCloud: copies.notChecked
        .filter((entry) => entry.reason === 'unavailable' || entry.reason === 'in-icloud')
        .reduce((sum, entry) => sum + entry.count, 0),
      blocked: cloudBlocked.copies,
    }),
  };
  const adjustments = useReviewAdjustments();
  const plan = useActionPlan();
  const session = useCleanSession.getState();
  // Content waits until Clean is first actually on screen (not under the
  // first-run introduction), then reveals once per session.
  const focused = useIsFocused();
  const reveal = useSessionReveal(focused);
  useFirstRunTour(focused);

  return (
    <Screen
      title="Clean"
      headerAccessory={
        <TourAnchor id="clean.settings">
          <IconButton
            icon="settings"
            accessibilityLabel="Settings"
            onPress={() => router.push('/settings')}
          />
        </TourAnchor>
      }
    >
      {reveal.ready ? (
        <CleanContent
          animateReveal={reveal.animate}
          copyCheck={copyCheck}
          analysis={analysis}
          state={state}
          access={access}
          job={job}
          actions={{
            onScanLibrary: scanLibrary,
            onSampleScan: session.startSampleScan,
            onManageSelection: () => {
              useCatalog
                .getState()
                .manageSelection()
                .catch(() => {});
            },
            onOpenSettings: () => {
              openSettings().catch(() => {});
            },
            onReset: session.reset,
            onOpenPlan: () => router.push('/plan'),
            onFindCopies: session.startCopyCheck,
            onAnalyze: session.startVisualAnalysis,
            onFullCheck: session.startFullCheck,
          }}
          scanActions={{
            onPause: session.pauseScan,
            onResume: session.resumeScan,
            onStop: session.cancelScan,
          }}
          adjustments={adjustments}
          plannedCount={plan.assetIds.length}
          libraryChanged={libraryChanged}
        />
      ) : null}
    </Screen>
  );
}
