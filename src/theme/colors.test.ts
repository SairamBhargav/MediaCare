import { palettes, type ColorToken, type Palette } from './colors';
import { contrastRatio } from './contrast';

const TEXT = 4.5;
const UI = 3;

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

describe.each(Object.entries(palettes) as [string, Palette][])('%s palette', (_, palette) => {
  test.each(requiredPairs)('%s on %s meets %d:1', (foreground, background, minimum) => {
    expect(contrastRatio(palette[foreground], palette[background])).toBeGreaterThanOrEqual(minimum);
  });
});

test('contrastRatio matches known WCAG values', () => {
  expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
  expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
});
