import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { ProgressBar } from '@/components/progress-bar';
import { StatusPill } from '@/components/status-pill';
import { Surface } from '@/components/surface';
import { jobFraction, type Job } from '@/domain/jobs';
import { jobProgressText, jobStatusLine, jobTitle } from '@/features/clean/job-text';
import { spacing } from '@/theme';

export type ScanActions = {
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
};

/** The Clean home while a scan runs: honest counts, stage, and controls. */
export function ScanningCard({ job, onPause, onResume, onStop }: { job: Job } & ScanActions) {
  const paused = job.status === 'paused';
  return (
    <Surface elevation="raised" style={styles.card}>
      <View style={styles.pills}>
        <StatusPill label={jobTitle(job)} tone="accent" icon="scan" />
        {job.sample ? <StatusPill label="Simulated" /> : null}
      </View>
      <AppText variant="title1">{paused ? 'Scan paused' : 'Scanning…'}</AppText>
      <AppText variant="body" color="secondaryLabel" style={styles.numbers}>
        {jobStatusLine(job)}
      </AppText>
      <ProgressBar
        fraction={jobFraction(job)}
        accessibilityLabel={`${jobTitle(job)} progress`}
        valueText={jobProgressText(job)}
        height={6}
        style={styles.progress}
      />
      <View style={styles.actions}>
        {paused ? (
          <Button title="Resume" icon="play" onPress={onResume} style={styles.flex} />
        ) : (
          <Button
            title="Pause"
            icon="pause"
            variant="secondary"
            onPress={onPause}
            style={styles.flex}
          />
        )}
        <Button
          title="Details"
          variant="secondary"
          onPress={() => router.push('/scan')}
          style={styles.flex}
        />
      </View>
      <Button
        title="Stop scan"
        variant="plain"
        onPress={onStop}
        accessibilityHint="Keeps the results found so far"
        style={styles.stop}
      />
      <AppText variant="footnote" color="secondaryLabel">
        You can keep browsing while it runs.
      </AppText>
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm, padding: spacing.lg },
  pills: { flexDirection: 'row', gap: spacing.xs },
  numbers: { fontVariant: ['tabular-nums'] },
  progress: { marginVertical: spacing.xs },
  actions: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  stop: { alignSelf: 'center' },
});
