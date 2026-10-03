import { useState, type ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { css } from 'react-native-reanimated';

import { cssEasing, duration, pressScale, useReduceMotion } from '@/theme';

type PressableScaleProps = Omit<PressableProps, 'style' | 'children'> & {
  children: ReactNode;
  /** Style of the visual element that scales (radius, background, size). */
  style?: StyleProp<ViewStyle>;
  /** Fade the element while disabled. Off for content that is simply not interactive. */
  dimWhenDisabled?: boolean;
};

/**
 * Press feedback for button-like elements: a 3% scale on press-in, released
 * on press-out, as a Reanimated CSS transition (no JS per frame). Under
 * Reduce Motion the same moment is shown with opacity instead of scale.
 *
 * Feedback appears on press-in, the action commits on press-out (`onPress`).
 */
export function PressableScale({
  children,
  style,
  onPressIn,
  onPressOut,
  disabled,
  dimWhenDisabled = true,
  ...props
}: PressableScaleProps) {
  const [pressed, setPressed] = useState(false);
  const reduceMotion = useReduceMotion();

  return (
    <Pressable
      hitSlop={8}
      pressRetentionOffset={16}
      disabled={disabled}
      onPressIn={(event) => {
        setPressed(true);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        setPressed(false);
        onPressOut?.(event);
      }}
      {...props}
    >
      <Animated.View
        style={[
          styles.base,
          style,
          pressed && (reduceMotion ? styles.pressedReduced : styles.pressed),
          disabled && dimWhenDisabled && styles.disabled,
        ]}
      >
        {children}
      </Animated.View>
    </Pressable>
  );
}

const styles = css.create({
  base: {
    transform: [{ scale: 1 }],
    opacity: 1,
    transitionProperty: ['transform', 'opacity'],
    transitionDuration: duration.press,
    transitionTimingFunction: cssEasing.out,
  },
  pressed: { transform: [{ scale: pressScale }] },
  pressedReduced: { opacity: 0.6 },
  disabled: { opacity: 0.4 },
});
