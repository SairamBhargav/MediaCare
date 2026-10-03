import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { formatDuration } from '@/domain/media';
import { isSample, type MediaItem } from '@/features/media/registry';
import { photoUri } from '@/services/media/photo-library';
import { onMedia, radius, spacing, useReduceMotion } from '@/theme';

import { AppText } from './app-text';
import { SampleArtwork } from './sample-artwork';

type MediaArtworkProps = {
  item: MediaItem;
  /** Glyph size for sample artwork. */
  glyphSize?: number;
  /** `cover` fills the frame (grids); `contain` shows the whole photo (viewer). */
  fit?: 'cover' | 'contain';
};

/**
 * Fills its parent with the item's picture: synthetic artwork for samples,
 * or a thumbnail decoded by iOS straight from Photos (`ph://` id) at the
 * displayed size. Never loads a full-size file for a grid tile.
 */
export function MediaArtwork({ item, glyphSize = 28, fit = 'cover' }: MediaArtworkProps) {
  const reduceMotion = useReduceMotion();
  if (isSample(item)) return <SampleArtwork asset={item} glyphSize={glyphSize} />;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Image
        source={{ uri: photoUri(item.id) }}
        style={StyleSheet.absoluteFill}
        contentFit={fit}
        recyclingKey={item.id}
        transition={reduceMotion ? 0 : 120}
        accessible={false}
      />
      {item.kind === 'video' && item.durationMs ? (
        <View style={styles.duration}>
          <AppText variant="caption" style={styles.onMedia}>
            {formatDuration(item.durationMs)}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  duration: {
    position: 'absolute',
    right: spacing.xxs + 2,
    bottom: spacing.xxs + 2,
    paddingHorizontal: spacing.xxs + 2,
    paddingVertical: 1,
    borderRadius: radius.sm,
    backgroundColor: onMedia.pill,
  },
  onMedia: { color: onMedia.foreground, fontVariant: ['tabular-nums'] },
});
