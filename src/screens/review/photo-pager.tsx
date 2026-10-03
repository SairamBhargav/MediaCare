import { forwardRef, useImperativeHandle, useRef } from 'react';
import { FlatList, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';

import { SampleArtwork } from '@/components/media-tile';
import type { SampleAsset } from '@/demo/sample-library';
import { gutter, radius, useReduceMotion, useTheme } from '@/theme';

export type PhotoPagerHandle = { scrollTo: (index: number) => void };

type PhotoPagerProps = {
  photos: readonly SampleAsset[];
  initialIndex: number;
  onIndexChange: (index: number) => void;
  /** Max photo height so the pager leaves room for details below it. */
  maxHeight: number;
};

/**
 * Full-width pager for one group. Horizontal paging is a native scroll view,
 * so it cooperates with the stack's edge back-swipe. Each page is a native
 * zoom view: pinch to inspect detail. Swiping only changes which photo is
 * shown; it never changes a review choice.
 */
export const PhotoPager = forwardRef<PhotoPagerHandle, PhotoPagerProps>(function PhotoPager(
  { photos, initialIndex, onIndexChange, maxHeight },
  ref,
) {
  const { width } = useWindowDimensions();
  const reduceMotion = useReduceMotion();
  const list = useRef<FlatList<SampleAsset>>(null);

  useImperativeHandle(ref, () => ({
    scrollTo: (index) => list.current?.scrollToIndex({ index, animated: !reduceMotion }),
  }));

  return (
    <FlatList
      ref={list}
      data={photos}
      keyExtractor={(photo) => photo.id}
      horizontal
      pagingEnabled
      showsHorizontalScrollIndicator={false}
      initialScrollIndex={initialIndex}
      getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
      onMomentumScrollEnd={(event) =>
        onIndexChange(Math.round(event.nativeEvent.contentOffset.x / width))
      }
      renderItem={({ item, index }) => (
        <ZoomablePhoto
          photo={item}
          width={width}
          maxHeight={maxHeight}
          label={`${item.description}. Photo ${index + 1} of ${photos.length}`}
        />
      )}
    />
  );
});

function ZoomablePhoto({
  photo,
  width,
  maxHeight,
  label,
}: {
  photo: SampleAsset;
  width: number;
  maxHeight: number;
  label: string;
}) {
  const { colors } = useTheme();
  const frameWidth = width - gutter * 2;
  const aspect = photo.width / photo.height;
  const height = Math.min(maxHeight, frameWidth / aspect);
  const photoWidth = height * aspect;

  return (
    <ScrollView
      style={{ width }}
      contentContainerStyle={[styles.page, { height }]}
      maximumZoomScale={4}
      minimumZoomScale={1}
      bouncesZoom
      centerContent
      showsHorizontalScrollIndicator={false}
      showsVerticalScrollIndicator={false}
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      accessibilityHint="Pinch to zoom"
    >
      <View
        style={[
          styles.photo,
          { width: photoWidth, height, backgroundColor: colors.mediaPlaceholder },
        ]}
      >
        <SampleArtwork asset={photo} glyphSize={64} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { alignItems: 'center', justifyContent: 'center' },
  photo: {
    borderRadius: radius.media,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
});
