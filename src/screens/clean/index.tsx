import { router } from 'expo-router';

import { IconButton } from '@/components/icon-button';
import { Screen } from '@/components/screen';
import { useCleanSession } from '@/state/clean-session';

import { CleanContent } from './clean-content';

export function CleanScreen() {
  const state = useCleanSession((session) => session.state);
  const job = useCleanSession((session) => session.job);
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
      />
    </Screen>
  );
}
