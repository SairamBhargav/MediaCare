import { router, useIsFocused } from 'expo-router';

import { IconButton } from '@/components/icon-button';
import { useSessionReveal } from '@/components/reveal';
import { Screen } from '@/components/screen';
import { useActionPlan } from '@/features/clean/use-action-plan';
import { scanLibrary } from '@/features/media/start-scan';
import { openSettings } from '@/services/media/photo-library';
import { useCatalog } from '@/state/catalog';
import { useCleanSession } from '@/state/clean-session';
import { useReviewAdjustments } from '@/state/review-session';

import { CleanContent } from './clean-content';

export function CleanScreen() {
  const state = useCleanSession((session) => session.state);
  const job = useCleanSession((session) => session.job);
  const access = useCatalog((catalog) => catalog.access);
  const libraryChanged = useCatalog((catalog) => catalog.libraryChanged);
  const adjustments = useReviewAdjustments();
  const plan = useActionPlan();
  const session = useCleanSession.getState();
  // Content waits until Clean is first actually on screen (not under the
  // first-run introduction), then reveals once per session.
  const reveal = useSessionReveal(useIsFocused());

  return (
    <Screen
      title="Clean"
      headerAccessory={
        <IconButton
          icon="settings"
          accessibilityLabel="Settings"
          onPress={() => router.push('/settings')}
        />
      }
    >
      {reveal.ready ? (
        <CleanContent
          animateReveal={reveal.animate}
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
