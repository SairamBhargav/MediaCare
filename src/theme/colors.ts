/**
 * Color tokens. Every color used by the app lives here.
 *
 * Contrast targets (WCAG 2.x): text roles >= 4.5:1 against the backgrounds they
 * sit on, UI/fill roles >= 3:1. `colors.test.ts` enforces the pairs listed in
 * docs/DESIGN_SYSTEM.md, so changing a value here re-runs the check.
 */

export type ColorScheme = 'light' | 'dark';

export type Palette = {
  /** Page background behind everything. */
  background: string;
  /** Default card / grouped surface. */
  surface: string;
  /** Surface stacked on a surface (chips, inputs, raised rows). */
  surfaceRaised: string;
  /** Translucent chrome tint used behind blur (tab bar, job bar). */
  chrome: string;
  /** Opaque chrome used when Reduce Transparency is on. */
  chromeSolid: string;
  label: string;
  secondaryLabel: string;
  /** Decorative / disabled only. Never for text that must be read. */
  tertiaryLabel: string;
  separator: string;
  /** Brand accent for icons, selection rings and large glyphs (>= 3:1). */
  accent: string;
  /** Brand accent safe for body-size text (>= 4.5:1). */
  accentText: string;
  /** Filled primary controls; carries `onAccent` text at >= 4.5:1. */
  accentFill: string;
  onAccent: string;
  danger: string;
  dangerFill: string;
  warning: string;
  success: string;
  info: string;
  /** Scrim over photos so overlaid labels stay legible. */
  mediaScrim: string;
  /** Placeholder behind media while it loads. */
  mediaPlaceholder: string;
};

export const palettes: Record<ColorScheme, Palette> = {
  light: {
    background: '#F6F6F8',
    surface: '#FFFFFF',
    surfaceRaised: '#EFEFF3',
    chrome: 'rgba(246, 246, 248, 0.72)',
    chromeSolid: '#F6F6F8',
    label: '#0B0B0F',
    secondaryLabel: '#62626C',
    tertiaryLabel: '#8E8E98',
    separator: '#D9D9DF',
    accent: '#FF375F',
    accentText: '#D6113F',
    accentFill: '#E0164A',
    onAccent: '#FFFFFF',
    danger: '#D70015',
    dangerFill: '#D70015',
    warning: '#A35200',
    success: '#1E7B34',
    info: '#0062CC',
    mediaScrim: 'rgba(0, 0, 0, 0.38)',
    mediaPlaceholder: '#E4E4EA',
  },
  dark: {
    background: '#0B0B0F',
    surface: '#17171D',
    surfaceRaised: '#22222A',
    chrome: 'rgba(23, 23, 29, 0.72)',
    chromeSolid: '#17171D',
    label: '#F5F5F7',
    secondaryLabel: '#9E9EA8',
    tertiaryLabel: '#6C6C76',
    separator: '#2C2C34',
    accent: '#FF375F',
    accentText: '#FF6482',
    accentFill: '#E0164A',
    onAccent: '#FFFFFF',
    danger: '#FF6961',
    dangerFill: '#D70015',
    warning: '#FF9F0A',
    success: '#30D158',
    info: '#409CFF',
    mediaScrim: 'rgba(0, 0, 0, 0.45)',
    mediaPlaceholder: '#22222A',
  },
};

/**
 * Used when iOS Settings → Accessibility → Display & Text Size → Increase
 * Contrast is on: stronger labels, separators and tints, and near-opaque
 * chrome. `colors.test.ts` checks these meet every pair the standard
 * palettes meet, never fall below them, and reach 7:1 for body text.
 */
export const highContrastPalettes: Record<ColorScheme, Palette> = {
  light: {
    background: '#F6F6F8',
    surface: '#FFFFFF',
    surfaceRaised: '#EFEFF3',
    chrome: 'rgba(246, 246, 248, 0.94)',
    chromeSolid: '#F6F6F8',
    label: '#000000',
    secondaryLabel: '#3C3C43',
    tertiaryLabel: '#6C6C74',
    separator: '#8E8E96',
    accent: '#C40E3A',
    accentText: '#A3002B',
    accentFill: '#B0002E',
    onAccent: '#FFFFFF',
    danger: '#A30011',
    dangerFill: '#A30011',
    warning: '#6E3700',
    success: '#11521F',
    info: '#00449A',
    mediaScrim: 'rgba(0, 0, 0, 0.5)',
    mediaPlaceholder: '#D9D9DF',
  },
  dark: {
    background: '#000000',
    surface: '#121216',
    surfaceRaised: '#1C1C22',
    chrome: 'rgba(18, 18, 22, 0.94)',
    chromeSolid: '#121216',
    label: '#FFFFFF',
    secondaryLabel: '#CFCFD6',
    tertiaryLabel: '#8E8E98',
    separator: '#71717B',
    accent: '#FF7A93',
    accentText: '#FF9AAE',
    accentFill: '#B0002E',
    onAccent: '#FFFFFF',
    danger: '#FF9A94',
    dangerFill: '#A30011',
    warning: '#FFC266',
    success: '#5BE38A',
    info: '#8CC4FF',
    mediaScrim: 'rgba(0, 0, 0, 0.55)',
    mediaPlaceholder: '#1C1C22',
  },
};

export type ColorToken = keyof Palette;

/**
 * Colors for controls drawn directly on top of photos. Fixed in both schemes:
 * the photo, not the app theme, is the background.
 */
export const onMedia = {
  foreground: '#FFFFFF',
  ring: 'rgba(255, 255, 255, 0.95)',
  badgeScrim: 'rgba(0, 0, 0, 0.18)',
  /** Dim applied to a selected photo so the ring and badge read clearly. */
  selectedDim: 'rgba(0, 0, 0, 0.16)',
  /** Background for small pills ("Keep", "Sample") placed on a photo. */
  pill: 'rgba(0, 0, 0, 0.5)',
  /** Glyph standing in for the subject of synthetic sample artwork. */
  sampleGlyph: 'rgba(255, 255, 255, 0.55)',
  /** Bottom fade so overlaid captions stay legible on bright photos. */
  captionFade: ['rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0.55)'] as const,
} as const;
