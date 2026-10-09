import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { EmptyState } from '@/components/empty-state';
import { Icon } from '@/components/icon';
import { SectionHeader } from '@/components/section-header';
import { ToolShell } from '@/components/tool-shell';
import { listDerivatives, loadRemovals, type DerivativeRow } from '@/db/catalog-repo';
import {
  batchDetails,
  batchHeadline,
  creationLabel,
  summarizeRemovals,
  type RemovalBatch,
} from '@/domain/activity';
import { formatBytes } from '@/domain/bytes';
import { photoUri } from '@/services/media/photo-library';
import { radius, spacing, useTheme } from '@/theme';

const when = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

/**
 * Activity (F12): removals with exactly what happened to each batch, where
 * to get photos back, and the new photos and videos MediaCare made.
 */
export function ActivityScreen() {
  const { colors } = useTheme();
  const [batches, setBatches] = useState<RemovalBatch[]>([]);
  const [made, setMade] = useState<DerivativeRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      Promise.all([loadRemovals(), listDerivatives(50)])
        .then(([removals, derivatives]) => {
          setBatches(summarizeRemovals(removals));
          setMade(derivatives);
        })
        .catch(() => {})
        .finally(() => setLoaded(true));
    }, []),
  );

  const anyRemoved = batches.some((batch) => batch.removed > 0);

  return (
    <ToolShell title="Activity" pills={false}>
      {loaded && batches.length === 0 && made.length === 0 ? (
        <EmptyState
          icon="clock"
          title="Nothing yet"
          message="Photos you remove and the copies, collages and videos you make will be listed here."
        />
      ) : null}

      {anyRemoved ? (
        <View style={[styles.notice, { backgroundColor: colors.surfaceRaised }]}>
          <Icon name="info" size={18} color={colors.secondaryLabel} />
          <AppText variant="subhead" style={styles.flex}>
            Changed your mind? Removed photos stay in the Photos app under Albums, Recently Deleted,
            for a while (Apple decides how long). You can recover them from there.
          </AppText>
        </View>
      ) : null}

      {batches.length > 0 ? (
        <View style={styles.section}>
          <SectionHeader title="Removals" />
          {batches.map((batch) => (
            <View
              key={batch.batchId}
              style={[styles.card, { backgroundColor: colors.surfaceRaised }]}
              accessible
            >
              <AppText variant="headline">{batchHeadline(batch)}</AppText>
              <AppText variant="footnote" color="secondaryLabel">
                {when.format(new Date(batch.at))}
              </AppText>
              {batchDetails(batch).map((line) => (
                <AppText key={line} variant="subhead" color="secondaryLabel">
                  {line}
                </AppText>
              ))}
            </View>
          ))}
        </View>
      ) : null}

      {made.length > 0 ? (
        <View style={styles.section}>
          <SectionHeader title="Made in MediaCare" />
          {made.map((row) => (
            <View key={row.id} style={styles.row} accessible>
              {row.output_asset_id ? (
                <Image
                  source={{ uri: photoUri(row.output_asset_id) }}
                  style={[styles.thumb, { backgroundColor: colors.mediaPlaceholder }]}
                  contentFit="cover"
                  accessibilityIgnoresInvertColors
                />
              ) : (
                <View style={[styles.thumb, { backgroundColor: colors.mediaPlaceholder }]} />
              )}
              <View style={styles.flex}>
                <AppText variant="subhead">{creationLabel(row.recipe, row.format)}</AppText>
                <AppText variant="footnote" color="secondaryLabel" style={styles.numbers}>
                  {when.format(new Date(row.created_at))}
                  {row.bytes > 0 ? ` · ${formatBytes(row.bytes)}` : ''}
                </AppText>
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </ToolShell>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  section: { gap: spacing.sm },
  card: { gap: spacing.xxs, padding: spacing.sm, borderRadius: radius.control },
  notice: {
    flexDirection: 'row',
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: radius.control,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  thumb: { width: 52, height: 52, borderRadius: radius.sm },
  numbers: { fontVariant: ['tabular-nums'] },
});
