import { cubicBezier, Easing } from 'react-native-reanimated';

/**
 * Motion tokens. Components never invent durations or springs; they pick one
 * of these. Rationale and the interaction inventory live in docs/MOTION.md.
 */
export const duration = {
  /** Press-in / press-out feedback. */
  press: 120,
  /** Small state changes: toggles, chips, badges, color. */
  state: 200,
  /** Sheets, expanding surfaces, screen-level choreography. */
  surface: 300,
  /** Rare completion emphasis (export done, review finished). */
  emphasis: 400,
  /** Delay between above-the-fold groups in a one-time reveal. */
  stagger: 40,
} as const;

/** Spring configs in Apple's duration + damping-ratio form. */
export const springs = {
  /** Default settle, no overshoot. */
  settle: { duration: 400, dampingRatio: 1 },
  /** Snap back after a drag; carries gesture velocity. */
  snap: { duration: 400, dampingRatio: 0.8 },
  /** Sheets and expanding bars. */
  sheet: { duration: 300, dampingRatio: 0.8 },
  /** A selection badge landing after a direct tap. */
  badge: { duration: 300, dampingRatio: 0.8 },
} as const;

/** For `withTiming` / `.easing(...)`. */
export const easing = {
  /** Strong ease-out: entering, exiting, most UI. */
  out: Easing.bezier(0.23, 1, 0.32, 1),
  /** Movement between two on-screen positions. */
  inOut: Easing.bezier(0.77, 0, 0.175, 1),
  /** iOS sheet curve. */
  sheet: Easing.bezier(0.32, 0.72, 0, 1),
} as const;

/** For Reanimated CSS transitions (`transitionTimingFunction`). */
export const cssEasing = {
  out: cubicBezier(0.23, 1, 0.32, 1),
  inOut: cubicBezier(0.77, 0, 0.175, 1),
} as const;

/** Press scale for button-like pressables. Full-width rows highlight instead. */
export const pressScale = 0.97;
