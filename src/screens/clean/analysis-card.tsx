import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { Surface } from '@/components/surface';
import { VISUAL_REASON_TEXT, type VisualCoverage } from '@/domain/visual-records';
import { spacing, useTheme } from '@/theme';

export type AnalysisSummary = {
  /** False in Expo Go: the native analysis isn't compiled in. */
  available: boolean;
  coverage: VisualCoverage;
  /** Status of the last photo check, or null if never run. */
  lastStatus: string | null;
};

/**
 * Entry point and report for the on-device photo check (Apple Vision):
 * similar shots that really look alike, possibly blurry, eyes closed, too
 * dark or bright. Says what was looked at and what wasn't, and why.
 */
export function AnalysisCard({
  summary,
  onStart,
}: {
  summary: AnalysisSummary;
  onStart: () => void;
}) {
  const { colors } = useTheme();
  const { available, coverage, lastStatus } = summary;
  const neverRun = lastStatus === null;
  const finished = lastStatus === 'succeeded';
  const notAnalyzed = coverage.notAnalyzed.reduce((sum, entry) => sum + entry.count, 0);

  return (
    <Surface style={styles.card}>
      <View style={styles.titleRow}>
        <Icon name="scan" size={20} color={colors.accent} />
        <AppText variant="headline" style={styles.flex}>
          Look at my photos
        </AppText>
      </View>
      <AppText variant="subhead" color="secondaryLabel">
        {!available
          ? 'Comparing how photos look needs the MediaCare app. It isn’t available in Expo Go.'
          : neverRun
            ? 'Uses Apple’s on-device image analysis to find similar shots that really look alike, possibly blurry photos, closed eyes, and very dark or blown-out photos, and suggests which shot to keep. Nothing leaves this iPhone.'
            : finished
              ? `${coverage.analyzed.toLocaleString()} photos looked at. Results are in the categories above.`
              : `The last check didn’t finish. ${coverage.analyzed.toLocaleString()} photos looked at so far; running it again continues.`}
      </AppText>
      {available && !neverRun && notAnalyzed > 0 ? (
        <View style={styles.reasons}>
          <AppText variant="footnote" color="secondaryLabel">
            Not looked at: {notAnalyzed.toLocaleString()}
          </AppText>
          {coverage.notAnalyzed.map(({ reason, count }) => (
            <AppText key={reason} variant="footnote" color="secondaryLabel" style={styles.numbers}>
              {count.toLocaleString()} · {VISUAL_REASON_TEXT[reason]}
            </AppText>
          ))}
        </View>
      ) : null}
      {available ? (
        <Button
          title={neverRun ? 'Look at my photos' : finished ? 'Check again' : 'Continue'}
          variant="secondary"
          icon="scan"
          onPress={onStart}
          accessibilityHint="Analyzes photos on this iPhone. Nothing is downloaded, uploaded or removed."
          block
        />
      ) : null}
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  flex: { flex: 1 },
  reasons: { gap: 2 },
  numbers: { fontVariant: ['tabular-nums'] },
});
