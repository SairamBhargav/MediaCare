import { highContrastPalettes, palettes, type ColorToken, type Palette } from './colors';
import { contrastRatio } from './contrast';

const TEXT = 4.5;
const UI = 3;
/** WCAG AAA for body text; what Increase Contrast should deliver. */
const ENHANCED = 7;

type Pair = [foreground: ColorToken, background: ColorToken, minimum: number];

const requiredPairs: Pair[] = [
  ['label', 'background', TEXT],
  ['label', 'surface', TEXT],
  ['label', 'surfaceRaised', TEXT],
  ['secondaryLabel', 'background', TEXT],
  ['secondaryLabel', 'surface', TEXT],
  ['secondaryLabel', 'surfaceRaised', TEXT],
  ['accentText', 'background', TEXT],
  ['accentText', 'surface', TEXT],
  ['onAccent', 'accentFill', TEXT],
  ['onAccent', 'dangerFill', TEXT],
  ['accent', 'background', UI],
  ['accent', 'surface', UI],
  ['danger', 'background', TEXT],
  ['danger', 'surface', TEXT],
  ['warning', 'background', TEXT],
  ['success', 'background', TEXT],
  ['info', 'background', TEXT],
];

const allPalettes: [string, Palette][] = [
  ['light', palettes.light],
  ['dark', palettes.dark],
  ['light high-contrast', highContrastPalettes.light],
  ['dark high-contrast', highContrastPalettes.dark],
];

describe.each(allPalettes)('%s palette', (_, palette) => {
  test.each(requiredPairs)('%s on %s meets %d:1', (foreground, background, minimum) => {
    expect(contrastRatio(palette[foreground], palette[background])).toBeGreaterThanOrEqual(minimum);
  });
});

describe.each(['light', 'dark'] as const)('%s Increase Contrast palette', (scheme) => {
  const standard = palettes[scheme];
  const high = highContrastPalettes[scheme];

  test.each(requiredPairs)('%s on %s is never lower than standard', (foreground, background) => {
    expect(contrastRatio(high[foreground], high[background])).toBeGreaterThanOrEqual(
      contrastRatio(standard[foreground], standard[background]) - 0.01,
    );
  });

  test.each([
    ['label', 'surfaceRaised'],
    ['secondaryLabel', 'background'],
    ['secondaryLabel', 'surface'],
    ['secondaryLabel', 'surfaceRaised'],
    ['accentText', 'background'],
    ['accentText', 'surface'],
    ['onAccent', 'accentFill'],
  ] as [ColorToken, ColorToken][])('%s on %s reaches 7:1', (foreground, background) => {
    expect(contrastRatio(high[foreground], high[background])).toBeGreaterThanOrEqual(ENHANCED);
  });

  test('separator is visible against surfaces (3:1)', () => {
    expect(contrastRatio(high.separator, high.surface)).toBeGreaterThanOrEqual(UI);
  });
});

test('contrastRatio matches known WCAG values', () => {
  expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
  expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
});
