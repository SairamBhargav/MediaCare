import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { MediaTile } from '@/components/media-tile';
import { getSampleAsset } from '@/demo/sample-library';
import { formatBytes } from '@/domain/bytes';
import type { ItemFinding } from '@/domain/findings';
import { spacing } from '@/theme';

type ItemReviewProps = {
  findings: readonly ItemFinding[];
  selectedIds: ReadonlySet<string>;
  onToggle: (assetId: string) => void;
};

/**
 * Single flagged photos (possibly blurry, large files). Every photo shows why
 * it was flagged and its size. There is no keeper: each photo stands alone.
 */
export function ItemReview({ findings, selectedIds, onToggle }: ItemReviewProps) {
  return (
    <View style={styles.grid}>
      {findings.map((finding) => {
        const asset = getSampleAsset(finding.assetId);
        return (
          <View key={finding.id} style={styles.cell}>
            <MediaTile
              asset={asset}
              appearance="card"
              selectable
              selected={selectedIds.has(asset.id)}
              onPress={() => onToggle(asset.id)}
            />
            <View style={styles.caption}>
              <AppText variant="footnote">{finding.reason}</AppText>
              <AppText variant="caption" color="secondaryLabel" style={styles.numbers}>
                {formatBytes(asset.bytes)} · sample size
              </AppText>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, rowGap: spacing.lg },
  cell: { width: '48%', gap: spacing.xs },
  caption: { gap: 2, paddingHorizontal: spacing.xxs },
  numbers: { fontVariant: ['tabular-nums'] },
});
