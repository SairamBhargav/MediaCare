import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { MediaArtwork } from '@/components/media-artwork';
import { PressableScale } from '@/components/pressable-scale';
import { formatBytes } from '@/domain/bytes';
import type { CategorySummary, FindingCategory } from '@/domain/findings';
import { CATEGORY_META, countLabel } from '@/features/clean/category-meta';
import { getMediaItem } from '@/features/media/registry';
import { minTouchTarget, radius, spacing, useTheme } from '@/theme';

/** Most worth reviewing first: sure things, then big files, then judgment calls. */
export const CATEGORY_PRIORITY: readonly FindingCategory[] = [
  'exact',
  'similar',
  'large',
  'moments',
  'blurry',
  'eyes-closed',
  'exposure',
  'screenshots',
  'long-videos',
];

export function byPriority(a: CategorySummary, b: CategorySummary): number {
  return CATEGORY_PRIORITY.indexOf(a.category) - CATEGORY_PRIORITY.indexOf(b.category);
}

/**
 * One finding category as a large, simple row: a photo from it, what it
 * is, how many, and (only when measured) how much space.
 */
export function CategoryRow({
  summary,
  sample,
  onPress,
}: {
  summary: CategorySummary;
  sample: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const meta = CATEGORY_META[summary.category];
  const lead = summary.previewAssetIds[0] ? getMediaItem(summary.previewAssetIds[0]) : null;
  const counts =
    summary.findingCount === summary.photoCount
      ? countLabel(summary.photoCount, meta.unit)
      : `${countLabel(summary.findingCount, meta.unit)} · ${countLabel(summary.photoCount, ['photo', 'photos'])}`;
  const size =
    summary.reclaimableBytes > 0 ? `up to ${formatBytes(summary.reclaimableBytes)}` : null;

  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${meta.title}${sample ? ', sample' : ''}. ${counts}${size ? `, ${size}` : ''}.`}
      accessibilityHint={meta.description}
      style={[styles.row, { backgroundColor: colors.surface }]}
    >
      <View style={[styles.preview, { backgroundColor: colors.mediaPlaceholder }]}>
        {lead ? <MediaArtwork item={lead} /> : <Icon name={meta.icon} color={colors.accent} />}
      </View>
      <View style={styles.text}>
        <AppText variant="headline">{meta.title}</AppText>
        <AppText variant="subhead" color="secondaryLabel" style={styles.numbers}>
          {counts}
          {size ? ` · ${size}` : ''}
        </AppText>
        <AppText variant="footnote" color="secondaryLabel" numberOfLines={2}>
          {meta.description}
        </AppText>
      </View>
      <Icon name="chevronRight" size={16} color={colors.tertiaryLabel} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.card,
    borderCurve: 'continuous',
    minHeight: minTouchTarget + spacing.xl,
  },
  preview: {
    width: 64,
    height: 64,
    borderRadius: radius.control,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, gap: 2 },
  numbers: { fontVariant: ['tabular-nums'] },
});
