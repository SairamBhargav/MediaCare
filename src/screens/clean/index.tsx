import { router } from 'expo-router';

import { IconButton } from '@/components/icon-button';
import { Screen } from '@/components/screen';
import { useActionPlan } from '@/features/clean/use-action-plan';
import { useCleanSession } from '@/state/clean-session';
import { useReviewAdjustments } from '@/state/review-session';

import { CleanContent } from './clean-content';

export function CleanScreen() {
  const state = useCleanSession((session) => session.state);
  const job = useCleanSession((session) => session.job);
  const adjustments = useReviewAdjustments();
  const plan = useActionPlan();
  const { startSampleScan, pauseScan, resumeScan, cancelScan, reset } = useCleanSession.getState();

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
      <CleanContent
        state={state}
        job={job}
        onStartScan={startSampleScan}
        onReset={reset}
        scanActions={{ onPause: pauseScan, onResume: resumeScan, onStop: cancelScan }}
        adjustments={adjustments}
        plannedCount={plan.assetIds.length}
        onOpenPlan={() => router.push('/plan')}
      />
    </Screen>
  );
}
