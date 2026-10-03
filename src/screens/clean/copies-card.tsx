import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { Surface } from '@/components/surface';
import { SKIP_REASON_TEXT, type CopyCoverage } from '@/domain/exact-copies';
import { spacing, useTheme } from '@/theme';

export type CopyCheckSummary = {
  coverage: CopyCoverage;
  /** Status of the last copies check ('succeeded', 'canceled', 'interrupted', …), or null if never run. */
  lastStatus: string | null;
  sets: number;
};

/**
 * Entry point and report for "Find exact copies" (P2-DUP-001). Says what
 * was checked, what wasn't and why, from stored results only.
 */
export function CopiesCard({
  summary,
  onStart,
  disabled,
}: {
  summary: CopyCheckSummary;
  onStart: () => void;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  const { coverage, lastStatus, sets } = summary;
  const neverRun = lastStatus === null;
  const finished = lastStatus === 'succeeded';
  const notChecked = coverage.notChecked.reduce((sum, entry) => sum + entry.count, 0);

  return (
    <Surface style={styles.card}>
      <View style={styles.titleRow}>
        <Icon name="duplicate" size={20} color={colors.accent} />
        <AppText variant="headline" style={styles.flex}>
          Exact copies
        </AppText>
      </View>
      <AppText variant="subhead" color="secondaryLabel">
        {neverRun
          ? 'Finds photos saved more than once by comparing their files, byte for byte. Takes about a minute per 1,000 photos. You can pause or stop; checked photos are remembered.'
          : finished
            ? sets === 0
              ? `No exact copies among ${coverage.checked.toLocaleString()} checked photos.`
              : `${sets.toLocaleString()} ${sets === 1 ? 'set' : 'sets'} of identical files among ${coverage.checked.toLocaleString()} checked photos.`
            : `The last check didn’t finish. ${coverage.checked.toLocaleString()} photos are checked so far; running it again continues.`}
      </AppText>
      {!neverRun && notChecked > 0 ? (
        <View style={styles.reasons} accessible accessibilityLabel={reasonsLabel(coverage)}>
          <AppText variant="footnote" color="secondaryLabel">
            Not checked: {notChecked.toLocaleString()}
          </AppText>
          {coverage.notChecked.map(({ reason, count }) => (
            <AppText key={reason} variant="footnote" color="secondaryLabel" style={styles.numbers}>
              {count.toLocaleString()} · {SKIP_REASON_TEXT[reason]}
            </AppText>
          ))}
        </View>
      ) : null}
      <Button
        title={neverRun ? 'Find exact copies' : finished ? 'Check again' : 'Continue checking'}
        variant="secondary"
        icon="duplicate"
        onPress={onStart}
        disabled={disabled}
        accessibilityHint="Reads photo files on this iPhone. Nothing is downloaded or removed."
        block
      />
    </Surface>
  );
}

function reasonsLabel(coverage: CopyCoverage): string {
  return `Not checked: ${coverage.notChecked
    .map(({ reason, count }) => `${count} ${SKIP_REASON_TEXT[reason]}`)
    .join('; ')}`;
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  flex: { flex: 1 },
  reasons: { gap: 2 },
  numbers: { fontVariant: ['tabular-nums'] },
});
