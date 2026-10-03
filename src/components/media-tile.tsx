import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { css } from 'react-native-reanimated';

import type { SampleAsset } from '@/demo/sample-library';
import { cssEasing, duration, onMedia, radius, spacing, useReduceMotion, useTheme } from '@/theme';
import { haptics } from '@/utils/haptics';

import { AppText } from './app-text';
import { Icon } from './icon';
import { PressableScale } from './pressable-scale';
import { SelectionBadge } from './selection-badge';

type MediaTileProps = {
  asset: SampleAsset;
  /** Shows the selection ring and exposes checkbox semantics. */
  selectable?: boolean;
  selected?: boolean;
  /** Marks the recommended keeper in a review group. Keepers are never selectable. */
  keeper?: boolean;
  onPress?: () => void;
  /** `grid` is dense and square-cornered; `card` is a rounded review card. */
  appearance?: 'grid' | 'card';
  style?: StyleProp<ViewStyle>;
};

/**
 * A photo in a grid or review group. Phase 0 renders synthetic sample
 * artwork; Phase 2 adds real thumbnails through expo-image (BACKLOG P2-MEDIA-004).
 */
export function MediaTile({
  asset,
  selectable = false,
  selected = false,
  keeper = false,
  onPress,
  appearance = 'grid',
  style,
}: MediaTileProps) {
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  const isCard = appearance === 'card';
  const checkable = selectable && !keeper;

  const label = keeper ? `${asset.description}. Recommended keeper` : asset.description;

  return (
    <PressableScale
      onPress={() => {
        if (checkable) haptics.selection();
        onPress?.();
      }}
      disabled={!onPress}
      dimWhenDisabled={false}
      accessibilityRole={checkable ? 'checkbox' : onPress ? 'imagebutton' : 'image'}
      accessibilityLabel={label}
      accessibilityState={checkable ? { checked: selected } : undefined}
      accessibilityHint={checkable ? 'Marks this photo for review' : undefined}
      style={[
        styles.tile,
        { backgroundColor: colors.mediaPlaceholder },
        isCard && styles.card,
        style,
      ]}
    >
      <SampleArtwork asset={asset} />

      {/* Selected state dims the photo slightly so the badge and ring read clearly. */}
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          styles.selectedOverlay,
          transitions.overlay,
          { borderColor: colors.accent, borderRadius: isCard ? radius.media : 0 },
          selected ? styles.selectedOn : styles.selectedOff,
          reduceMotion && transitions.instant,
        ]}
      />

      {keeper ? (
        <View style={styles.keeperPill} accessibilityElementsHidden>
          <Icon name="star" size={11} color={onMedia.foreground} weight="bold" />
          <AppText variant="caption" style={styles.onMediaText}>
            Keep
          </AppText>
        </View>
      ) : null}

      {checkable ? (
        <View style={[styles.badge, isCard && styles.badgeCard]}>
          <SelectionBadge selected={selected} size={isCard ? 28 : 24} />
        </View>
      ) : null}
    </PressableScale>
  );
}

function SampleArtwork({ asset }: { asset: SampleAsset }) {
  return (
    <View style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={asset.colors}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.subject}>
        <Icon name={asset.subject} size={28} color={onMedia.sampleGlyph} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    aspectRatio: 1,
    overflow: 'hidden',
  },
  card: {
    borderRadius: radius.media,
    borderCurve: 'continuous',
  },
  subject: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedOverlay: {
    borderWidth: 3,
    backgroundColor: onMedia.selectedDim,
  },
  selectedOn: { opacity: 1 },
  selectedOff: { opacity: 0 },
  badge: {
    position: 'absolute',
    right: spacing.xxs + 2,
    bottom: spacing.xxs + 2,
  },
  badgeCard: {
    right: spacing.sm,
    bottom: spacing.sm,
  },
  keeperPill: {
    position: 'absolute',
    left: spacing.sm,
    top: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    paddingHorizontal: spacing.xs,
    paddingVertical: 3,
    borderRadius: radius.full,
    backgroundColor: onMedia.pill,
  },
  onMediaText: { color: onMedia.foreground },
});

const transitions = css.create({
  overlay: {
    transitionProperty: 'opacity',
    transitionDuration: duration.state,
    transitionTimingFunction: cssEasing.out,
  },
  instant: { transitionDuration: 0 },
});
