import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { Icon } from '@/components/icon';
import { ProgressBar } from '@/components/progress-bar';
import { StatusPill } from '@/components/status-pill';
import { JOB_STAGES, STAGE_LABEL, isActive, jobFraction, type Job } from '@/domain/jobs';
import { jobProgressText, jobStatusLine, jobTitle } from '@/features/clean/job-text';
import { useCleanSession } from '@/state/clean-session';
import { gutter, radius, spacing, useTheme } from '@/theme';

/**
 * Expanded scan detail, presented as a sheet from the job bar. Shows the
 * current stage, honest counts, and pause / resume / stop controls. Browsing
 * stays usable while it runs: dismissing the sheet does not stop the scan.
 */
export function ScanScreen() {
  const { colors } = useTheme();
  const job = useCleanSession((session) => session.job);

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
    >
      {job ? (
        <ScanDetail job={job} />
      ) : (
        <EmptyState
          icon="scan"
          title="No scan running"
          message="Start a sample scan from the Clean tab."
          action={<Button title="Close" variant="secondary" onPress={() => router.back()} />}
        />
      )}
    </ScrollView>
  );
}

function ScanDetail({ job }: { job: Job }) {
  const { colors } = useTheme();
  const { pauseScan, resumeScan, cancelScan, dismissJob } = useCleanSession.getState();
  const active = isActive(job);
  const stageIndex = JOB_STAGES.indexOf(job.stage);

  return (
    <View style={styles.detail}>
      <View style={styles.header}>
        <View style={styles.pills}>
          <StatusPill label={jobTitle(job)} tone="accent" icon="scan" />
          {job.sample ? <StatusPill label="Simulated" /> : null}
        </View>
        <AppText variant="title1" style={styles.numbers} accessibilityLiveRegion="polite">
          {job.total === null
            ? 'Finding photos…'
            : `${job.processed.toLocaleString()} of ${job.total.toLocaleString()}`}
        </AppText>
        <AppText variant="body" color="secondaryLabel">
          {jobStatusLine(job)}
        </AppText>
      </View>

      <ProgressBar
        fraction={job.status === 'succeeded' ? 1 : jobFraction(job)}
        accessibilityLabel={`${jobTitle(job)} progress`}
        valueText={jobProgressText(job)}
        height={6}
      />

      <View style={[styles.stages, { backgroundColor: colors.surface }]}>
        {JOB_STAGES.map((stage, index) => {
          const done = job.status === 'succeeded' || index < stageIndex;
          const current = active && index === stageIndex;
          const state = done ? 'done' : current ? 'in progress' : 'not started';
          return (
            <View
              key={stage}
              style={styles.stage}
              accessible
              accessibilityLabel={`${STAGE_LABEL[stage]}, ${state}`}
            >
              <Icon
                name={done ? 'checkCircle' : 'circle'}
                size={20}
                color={done || current ? colors.accent : colors.tertiaryLabel}
              />
              <AppText variant="body" color={done || current ? 'label' : 'secondaryLabel'}>
                {STAGE_LABEL[stage]}
              </AppText>
              {current && job.status === 'paused' ? (
                <AppText variant="footnote" color="secondaryLabel">
                  Paused
                </AppText>
              ) : null}
            </View>
          );
        })}
      </View>

      {active ? (
        <View style={styles.actions}>
          {job.status === 'paused' ? (
            <Button title="Resume" icon="play" onPress={resumeScan} block />
          ) : (
            <Button title="Pause" icon="pause" variant="secondary" onPress={pauseScan} block />
          )}
          <Button
            title="Stop scan"
            variant="plain"
            onPress={cancelScan}
            accessibilityHint="Keeps the results found so far"
          />
        </View>
      ) : (
        <Button
          title={job.status === 'succeeded' ? 'View results' : 'Done'}
          onPress={() => {
            dismissJob();
            router.back();
            router.navigate('/');
          }}
          block
        />
      )}

      <View style={[styles.note, { backgroundColor: colors.surfaceRaised }]}>
        <Icon name="info" size={16} color={colors.secondaryLabel} />
        <AppText variant="footnote" color="secondaryLabel" style={styles.flex}>
          {job.sample
            ? 'This scan is simulated on sample images to show how scanning works. It reads none of your photos.'
            : 'You can keep using MediaCare while the scan runs.'}{' '}
          Closing this sheet doesn’t stop the scan.
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: gutter, paddingTop: spacing.xl },
  detail: { gap: spacing.xl },
  header: { gap: spacing.xs },
  pills: { flexDirection: 'row', gap: spacing.xs },
  numbers: { fontVariant: ['tabular-nums'] },
  stages: {
    borderRadius: radius.card,
    borderCurve: 'continuous',
    paddingVertical: spacing.xs,
  },
  stage: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  actions: { gap: spacing.xs, alignItems: 'stretch' },
  note: {
    flexDirection: 'row',
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: radius.control,
  },
  flex: { flex: 1 },
});
