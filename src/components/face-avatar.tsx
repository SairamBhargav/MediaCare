import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { faceCrop, type FaceRecord } from '@/domain/people';
import { photoUri } from '@/services/media/photo-library';
import { useCatalog } from '@/state/catalog';
import { radius, useReduceMotion, useTheme } from '@/theme';

/**
 * A person's face in a circle, cut from their photo by the face box
 * (ADR-0011). iOS decodes the photo from Photos at the drawn size; nothing
 * is saved. Falls back to the whole photo if its size isn't known.
 */
export function FaceAvatar({ face, size }: { face: FaceRecord; size: number }) {
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  const item = useCatalog((catalog) => catalog.byId.get(face.assetId));
  const crop =
    item?.width && item.height ? faceCrop(face.box, item.width, item.height, size) : null;

  return (
    <View
      style={[styles.circle, { width: size, height: size, backgroundColor: colors.surfaceRaised }]}
      accessible={false}
    >
      <Image
        source={{ uri: photoUri(face.assetId) }}
        style={
          crop
            ? {
                position: 'absolute',
                width: crop.width,
                height: crop.height,
                left: crop.left,
                top: crop.top,
              }
            : StyleSheet.absoluteFill
        }
        contentFit={crop ? 'fill' : 'cover'}
        recyclingKey={`${face.assetId}-${face.id}`}
        transition={reduceMotion ? 0 : 120}
        accessible={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { borderRadius: radius.full, overflow: 'hidden' },
});
