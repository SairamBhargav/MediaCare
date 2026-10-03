import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { css } from 'react-native-reanimated';

import type { MediaItem } from '@/features/media/registry';
import { cssEasing, duration, onMedia, radius, spacing, useReduceMotion, useTheme } from '@/theme';
import { haptics } from '@/utils/haptics';
import { showPhotoActions, type PhotoAction } from '@/utils/photo-actions';

import { AppText } from './app-text';
import { Icon } from './icon';
import { MediaArtwork } from './media-artwork';
import { PressableScale } from './pressable-scale';
import { SelectionBadge } from './selection-badge';

type MediaTileProps = {
  asset: MediaItem;
  /** Shows the selection ring and exposes checkbox semantics. */
  selectable?: boolean;
  selected?: boolean;
  /** Marks the keeper in a review group. Keepers are never selectable. */
  keeper?: boolean;
  /** Protected by the user: never selectable for removal. */
  isProtected?: boolean;
  onPress?: () => void;
  /**
   * Secondary actions (make keeper, protect). Shown on long-press as a native
   * action sheet and offered to VoiceOver as custom actions.
   */
  actions?: readonly PhotoAction[];
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
  isProtected = false,
  onPress,
  actions = [],
  appearance = 'grid',
  style,
}: MediaTileProps) {
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  const isCard = appearance === 'card';
  const checkable = selectable && !keeper && !isProtected;

  const label = [
    asset.description,
    asset.isFavorite && 'Favorite',
    keeper && 'Keeper',
    isProtected && 'Protected',
  ]
    .filter(Boolean)
    .join('. ');

  return (
    <PressableScale
      onPress={() => {
        if (checkable) haptics.selection();
        onPress?.();
      }}
      disabled={!onPress && actions.length === 0}
      dimWhenDisabled={false}
      onLongPress={
        actions.length > 0
          ? () => {
              haptics.light();
              showPhotoActions(asset.description, actions);
            }
          : undefined
      }
      accessibilityActions={actions.map((action) => ({ name: action.label, label: action.label }))}
      onAccessibilityAction={(event) =>
        actions.find((action) => action.label === event.nativeEvent.actionName)?.onPress()
      }
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
      <MediaArtwork item={asset} />

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

      {keeper || isProtected || asset.isFavorite ? (
        <View style={styles.pills} accessibilityElementsHidden>
          {keeper ? (
            <View style={styles.pill}>
              <Icon name="star" size={11} color={onMedia.foreground} weight="bold" />
              <AppText variant="caption" style={styles.onMediaText}>
                Keep
              </AppText>
            </View>
          ) : null}
          {asset.isFavorite ? (
            <View style={styles.pill}>
              <Icon name="heart" size={10} color={onMedia.foreground} weight="bold" />
            </View>
          ) : null}
          {isProtected ? (
            <View style={styles.pill}>
              <Icon name="lock" size={10} color={onMedia.foreground} weight="bold" />
              <AppText variant="caption" style={styles.onMediaText}>
                Protected
              </AppText>
            </View>
          ) : null}
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

const styles = StyleSheet.create({
  tile: {
    aspectRatio: 1,
    overflow: 'hidden',
  },
  card: {
    borderRadius: radius.media,
    borderCurve: 'continuous',
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
  pills: {
    position: 'absolute',
    left: spacing.sm,
    top: spacing.sm,
    right: spacing.sm,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xxs,
  },
  pill: {
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
