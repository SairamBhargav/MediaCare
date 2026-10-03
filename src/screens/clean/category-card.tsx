import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { SampleArtwork } from '@/components/media-tile';
import { PressableScale } from '@/components/pressable-scale';
import { getSampleAsset } from '@/demo/sample-library';
import { formatBytes } from '@/domain/bytes';
import type { CategorySummary } from '@/domain/findings';
import { CATEGORY_META, countLabel } from '@/features/clean/category-meta';
import { radius, shadows, spacing, useTheme } from '@/theme';

type CategoryCardProps = {
  summary: CategorySummary;
  width: number;
  onPress: () => void;
};

/** Fanned stack geometry for up to three preview photos, back to front. */
const FAN = [
  { rotate: '-8deg', translateX: -30, scale: 0.88 },
  { rotate: '7deg', translateX: 30, scale: 0.88 },
  { rotate: '0deg', translateX: 0, scale: 1 },
] as const;

const ART_HEIGHT = 172;
const THUMB = 116;

/**
 * Photo-led category card: the photos come first, with a soft backdrop
 * tinted from the lead photo (artwork-led, like an album card). Text below
 * says what the category is, how much it holds, and that it is sample data.
 */
export function CategoryCard({ summary, width, onPress }: CategoryCardProps) {
  const { colors, scheme } = useTheme();
  const meta = CATEGORY_META[summary.category];
  const previews = summary.previewAssetIds.map(getSampleAsset);
  const lead = previews[0];
  // Draw back-to-front so the lead photo sits on top.
  const layers = previews.length === 1 ? [lead] : [...previews.slice(1), lead];
  const fan = FAN.slice(FAN.length - layers.length);

  const counts = `${countLabel(summary.findingCount, meta.unit)} · ${countLabel(summary.photoCount, ['photo', 'photos'])}`;
  const size = `Up to ${formatBytes(summary.reclaimableBytes)}`;

  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${meta.title}, sample. ${counts}. ${size}.`}
      accessibilityHint="Opens this category"
      style={[
        styles.card,
        { width, backgroundColor: colors.surface },
        scheme === 'light' && { boxShadow: shadows.card },
      ]}
    >
      <View style={styles.art}>
        <LinearGradient
          colors={lead.colors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { opacity: scheme === 'dark' ? 0.28 : 0.38 }]}
        />
        {layers.map((asset, index) => (
          <View
            key={asset.id}
            style={[
              styles.thumb,
              {
                transform: [
                  { translateX: fan[index].translateX },
                  { rotate: fan[index].rotate },
                  { scale: fan[index].scale },
                ],
              },
            ]}
          >
            <SampleArtwork asset={asset} glyphSize={30} />
          </View>
        ))}
      </View>
      <View style={styles.text}>
        <AppText variant="eyebrow" color="accentText">
          Sample
        </AppText>
        <AppText variant="headline">{meta.title}</AppText>
        <AppText variant="subhead" color="secondaryLabel">
          {counts}
        </AppText>
        <AppText variant="footnote" color="secondaryLabel" style={styles.numbers}>
          {size}
        </AppText>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.media,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  art: {
    height: ART_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumb: {
    position: 'absolute',
    width: THUMB,
    height: THUMB,
    borderRadius: radius.card,
    borderCurve: 'continuous',
    overflow: 'hidden',
    boxShadow: shadows.raised,
  },
  text: {
    padding: spacing.md,
    gap: 2,
  },
  numbers: { fontVariant: ['tabular-nums'] },
});
