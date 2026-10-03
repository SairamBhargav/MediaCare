import { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { duration, easing, radius, useReduceMotion, useTheme } from '@/theme';

type ProgressBarProps = {
  /** 0–1, or `null` when the total is unknown (indeterminate). */
  fraction: number | null;
  /** Spoken label, e.g. "Sample scan progress". */
  accessibilityLabel: string;
  /** Spoken value, e.g. "48 of 112 photos checked". */
  valueText: string;
  height?: number;
  style?: StyleProp<ViewStyle>;
};

const INDETERMINATE_MS = 1200;

/**
 * Thin progress track. Determinate: the fill eases between the values the
 * job actually reported; it never advances on its own. Indeterminate: a
 * short segment sweeps across. Reduce Motion: fills jump to the new value
 * and the indeterminate sweep becomes a static, dimmed track.
 *
 * Animates `width`/`left` on an absolutely positioned, childless fill: it is
 * out of flow, so nothing else re-lays out.
 */
export function ProgressBar({
  fraction,
  accessibilityLabel,
  valueText,
  height = 4,
  style,
}: ProgressBarProps) {
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  const value = useSharedValue(fraction ?? 0);
  const sweep = useSharedValue(0);
  const indeterminate = fraction === null;

  useEffect(() => {
    if (fraction === null) return;
    const target = Math.max(0, Math.min(1, fraction));
    value.set(
      reduceMotion ? target : withTiming(target, { duration: duration.state, easing: easing.out }),
    );
  }, [fraction, reduceMotion, value]);

  useEffect(() => {
    if (!indeterminate || reduceMotion) {
      cancelAnimation(sweep);
      sweep.set(0);
      return;
    }
    sweep.set(0);
    sweep.set(withRepeat(withTiming(1, { duration: INDETERMINATE_MS, easing: easing.inOut }), -1));
    return () => cancelAnimation(sweep);
  }, [indeterminate, reduceMotion, sweep]);

  const fillStyle = useAnimatedStyle(() => {
    if (indeterminate) {
      if (reduceMotion) return { left: '0%', width: '100%', opacity: 0.35 };
      return { left: `${-35 + sweep.get() * 135}%`, width: '35%', opacity: 1 };
    }
    return { left: '0%', width: `${value.get() * 100}%`, opacity: 1 };
  });

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ text: valueText }}
      style={[
        styles.track,
        { height, borderRadius: radius.full, backgroundColor: colors.surfaceRaised },
        style,
      ]}
    >
      <Animated.View
        style={[
          styles.fill,
          { borderRadius: radius.full, backgroundColor: colors.accent },
          fillStyle,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { overflow: 'hidden', alignSelf: 'stretch' },
  fill: { position: 'absolute', top: 0, bottom: 0 },
});
