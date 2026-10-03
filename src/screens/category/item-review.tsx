import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { MediaTile } from '@/components/media-tile';
import { getMediaItem } from '@/features/media/registry';
import { formatSize } from '@/domain/bytes';
import type { ItemFinding } from '@/domain/findings';
import { useReviewSession } from '@/state/review-session';
import { spacing } from '@/theme';

/**
 * Single flagged photos (possibly blurry, large files). Every photo shows why
 * it was flagged and its size. There is no keeper: each photo stands alone.
 * Selections and protection are kept for the session.
 */
export function ItemReview({ findings }: { findings: readonly ItemFinding[] }) {
  const { itemSelectedIds, protectedIds, toggleItem, toggleProtected } = useReviewSession();

  return (
    <View style={styles.section}>
      <View style={styles.grid}>
        {findings.map((finding) => {
          const asset = getMediaItem(finding.assetId);
          const isProtected = protectedIds.has(asset.id);
          return (
            <View key={finding.id} style={styles.cell}>
              <MediaTile
                asset={asset}
                appearance="card"
                selectable
                isProtected={isProtected}
                selected={itemSelectedIds.has(asset.id)}
                onPress={isProtected ? undefined : () => toggleItem(asset.id)}
                actions={[
                  {
                    label: isProtected ? 'Unprotect' : 'Protect',
                    onPress: () => toggleProtected(asset.id),
                  },
                ]}
              />
              <View style={styles.caption}>
                <AppText variant="footnote">{finding.reason}</AppText>
                <AppText variant="caption" color="secondaryLabel" style={styles.numbers}>
                  {asset.source === 'sample'
                    ? `${formatSize(asset.bytes)} · sample size`
                    : formatSize(asset.bytes)}
                </AppText>
              </View>
            </View>
          );
        })}
      </View>
      <AppText variant="footnote" color="secondaryLabel">
        Touch and hold a photo to protect it.
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, rowGap: spacing.lg },
  cell: { width: '48%', gap: spacing.xs },
  caption: { gap: 2, paddingHorizontal: spacing.xxs },
  numbers: { fontVariant: ['tabular-nums'] },
});
