import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { duration, easing, onMedia, springs, useReduceMotion, useTheme } from '@/theme';

import { Icon } from './icon';

type SelectionBadgeProps = {
  selected: boolean;
  size?: number;
};

const UNSELECTED_SCALE = 0.6;

/**
 * The check badge on a selectable photo. The empty ring is always visible so
 * the tile reads as selectable; the filled check springs in when selected.
 * Purely visual: the parent owns the accessibility state.
 *
 * Interruptible: tapping again mid-spring retargets from the current value.
 * Reduce Motion: the fill fades without scaling.
 */
export function SelectionBadge({ selected, size = 26 }: SelectionBadgeProps) {
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  const progress = useSharedValue(selected ? 1 : 0);

  useEffect(() => {
    const target = selected ? 1 : 0;
    progress.set(
      reduceMotion
        ? withTiming(target, { duration: duration.state, easing: easing.out })
        : selected
          ? withSpring(target, springs.badge)
          : withTiming(target, { duration: duration.press, easing: easing.out }),
    );
  }, [selected, reduceMotion, progress]);

  const fillStyle = useAnimatedStyle(() => {
    const value = progress.get();
    const scale = reduceMotion ? 1 : UNSELECTED_SCALE + (1 - UNSELECTED_SCALE) * value;
    return { opacity: Math.min(1, value), transform: [{ scale }] };
  });

  const dimension = { width: size, height: size, borderRadius: size / 2 };

  return (
    <Animated.View style={[styles.ring, dimension]} pointerEvents="none">
      <Animated.View
        style={[styles.fill, dimension, { backgroundColor: colors.accent }, fillStyle]}
      >
        <Icon name="check" size={size * 0.5} color={colors.onAccent} weight="bold" />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  ring: {
    borderWidth: 1.5,
    // Fixed ring with a scrim: it always sits on top of a photo.
    borderColor: onMedia.ring,
    backgroundColor: onMedia.badgeScrim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fill: {
    position: 'absolute',
    top: -1.5,
    left: -1.5,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: onMedia.foreground,
  },
});
