import type { TextStyle } from 'react-native';

/** 4-point spacing scale. Name by size, not by use. */
export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
} as const;

/** Default horizontal page gutter. */
export const gutter = spacing.lg;

export const radius = {
  sm: 8,
  control: 12,
  card: 16,
  media: 22,
  sheet: 28,
  full: 9999,
} as const;

/** Minimum practical touch target (Apple HIG). */
export const minTouchTarget = 44;

/**
 * Type ramp. System font on iOS (SF Pro) so Dynamic Type and optical sizing
 * behave natively. Sizes follow the iOS text-style scale at the default
 * content size; `allowFontScaling` stays on everywhere.
 */
export const typography = {
  largeTitle: { fontSize: 34, lineHeight: 41, fontWeight: '700', letterSpacing: 0.37 },
  title1: { fontSize: 28, lineHeight: 34, fontWeight: '700', letterSpacing: 0.36 },
  title2: { fontSize: 22, lineHeight: 28, fontWeight: '700', letterSpacing: 0.35 },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: '600', letterSpacing: -0.41 },
  body: { fontSize: 17, lineHeight: 22, fontWeight: '400', letterSpacing: -0.41 },
  callout: { fontSize: 16, lineHeight: 21, fontWeight: '400', letterSpacing: -0.32 },
  subhead: { fontSize: 15, lineHeight: 20, fontWeight: '400', letterSpacing: -0.24 },
  footnote: { fontSize: 13, lineHeight: 18, fontWeight: '400', letterSpacing: -0.08 },
  /** Small uppercase kicker above editorial headings. */
  eyebrow: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500', letterSpacing: 0 },
} as const satisfies Record<string, TextStyle>;

export type TypographyVariant = keyof typeof typography;

/**
 * Layered elevation as CSS box-shadow strings (supported by the New
 * Architecture). Shadows are only visible in light mode; dark mode separates
 * layers with surface color instead.
 */
export const shadows = {
  card: '0 1px 2px rgba(0, 0, 0, 0.06), 0 4px 16px rgba(0, 0, 0, 0.06)',
  raised: '0 8px 28px rgba(0, 0, 0, 0.14)',
  none: '0 0 0 rgba(0, 0, 0, 0)',
} as const;
