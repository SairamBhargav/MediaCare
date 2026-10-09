import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { MediaTile } from '@/components/media-tile';
import { formatSize } from '@/domain/bytes';
import type { ItemFinding } from '@/domain/findings';
import { getMediaItem } from '@/features/media/registry';
import { useReviewSession } from '@/state/review-session';
import { spacing } from '@/theme';

/**
 * A row of single flagged photos (possibly blurry, large files, …) in a
 * virtualized list. Every photo shows why it was flagged and its size;
 * there is no keeper. Each cell listens only to its own selection and
 * protection, so tapping one photo redraws only that photo.
 */
export const ItemRow = memo(function ItemRow({ findings }: { findings: readonly ItemFinding[] }) {
  return (
    <View style={styles.row}>
      {findings.map((finding) => (
        <ItemCell key={finding.id} finding={finding} />
      ))}
    </View>
  );
});

function ItemCell({ finding }: { finding: ItemFinding }) {
  const asset = getMediaItem(finding.assetId);
  const selected = useReviewSession((state) => state.itemSelectedIds.has(asset.id));
  const isProtected = useReviewSession((state) => state.protectedIds.has(asset.id));
  const { toggleItem, toggleProtected } = useReviewSession.getState();

  return (
    <View style={styles.cell}>
      <MediaTile
        asset={asset}
        appearance="card"
        selectable
        isProtected={isProtected}
        selected={selected}
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
}

/** Shown under the photos of an item category. */
export function ItemHint() {
  return (
    <AppText variant="footnote" color="secondaryLabel">
      Touch and hold a photo to protect it.
    </AppText>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm },
  cell: { width: '48%', gap: spacing.xs },
  caption: { gap: 2, paddingHorizontal: spacing.xxs },
  numbers: { fontVariant: ['tabular-nums'] },
});
