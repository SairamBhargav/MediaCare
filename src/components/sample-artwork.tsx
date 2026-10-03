import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import type { SampleAsset } from '@/demo/sample-library';
import { onMedia } from '@/theme';

import { Icon } from './icon';

/**
 * Synthetic stand-in image for a sample asset: a gradient with a subject
 * glyph. `soft` samples are drawn out of focus. Fills its parent.
 */
export function SampleArtwork({
  asset,
  glyphSize = 28,
}: {
  asset: SampleAsset;
  glyphSize?: number;
}) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient
        colors={asset.colors}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.subject}>
        <Icon name={asset.subject} size={glyphSize} color={onMedia.sampleGlyph} />
      </View>
      {asset.look === 'soft' ? (
        // A static blur layer (never animated) makes the stand-in read as out of focus.
        <BlurView intensity={28} tint="default" style={StyleSheet.absoluteFill} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  subject: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
