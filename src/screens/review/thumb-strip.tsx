import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Icon, type IconName } from '@/components/icon';
import { SampleArtwork } from '@/components/media-tile';
import type { SampleAsset } from '@/demo/sample-library';
import { gutter, onMedia, radius, spacing, useTheme } from '@/theme';

type ThumbStripProps = {
  photos: readonly SampleAsset[];
  currentIndex: number;
  keeperId: string;
  selectedIds: ReadonlySet<string>;
  protectedIds: ReadonlySet<string>;
  onSelectIndex: (index: number) => void;
};

const THUMB = 56;

/** Small thumbnails of the group with keeper / protected / marked markers. */
export function ThumbStrip({
  photos,
  currentIndex,
  keeperId,
  selectedIds,
  protectedIds,
  onSelectIndex,
}: ThumbStripProps) {
  const { colors } = useTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.strip}
      accessibilityRole="tablist"
      accessibilityLabel="Photos in this group"
    >
      {photos.map((photo, index) => {
        const current = index === currentIndex;
        const marker: IconName | null =
          photo.id === keeperId
            ? 'star'
            : protectedIds.has(photo.id)
              ? 'lock'
              : selectedIds.has(photo.id)
                ? 'check'
                : null;
        const status =
          photo.id === keeperId
            ? 'keeper'
            : protectedIds.has(photo.id)
              ? 'protected'
              : selectedIds.has(photo.id)
                ? 'marked for review'
                : '';
        return (
          <Pressable
            key={photo.id}
            onPress={() => onSelectIndex(index)}
            accessibilityRole="tab"
            accessibilityState={{ selected: current }}
            accessibilityLabel={`Photo ${index + 1}${status ? `, ${status}` : ''}`}
            hitSlop={4}
            style={[styles.thumb, { borderColor: current ? colors.accent : 'transparent' }]}
          >
            <View style={styles.inner}>
              <SampleArtwork asset={photo} glyphSize={18} />
            </View>
            {marker ? (
              <View style={[styles.marker, { backgroundColor: colors.accentFill }]}>
                <Icon name={marker} size={9} color={onMedia.foreground} weight="bold" />
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  strip: { paddingHorizontal: gutter, gap: spacing.xs, paddingVertical: spacing.xxs },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: radius.control,
    borderCurve: 'continuous',
    borderWidth: 2,
    padding: 2,
  },
  inner: {
    flex: 1,
    borderRadius: radius.sm,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  marker: {
    position: 'absolute',
    right: -2,
    top: -2,
    width: 16,
    height: 16,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
