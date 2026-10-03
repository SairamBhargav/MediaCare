import { router } from 'expo-router';

import { IconButton } from '@/components/icon-button';
import { Screen } from '@/components/screen';
import { useCleanSession } from '@/state/clean-session';

import { CleanContent } from './clean-content';

export function CleanScreen() {
  const state = useCleanSession((session) => session.state);
  const showSampleResults = useCleanSession((session) => session.showSampleResults);
  const reset = useCleanSession((session) => session.reset);

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
      <CleanContent state={state} onShowSample={showSampleResults} onReset={reset} />
    </Screen>
  );
}
