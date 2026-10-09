import {
  NEUTRAL,
  centeredCrop,
  clampSlider,
  isNeutral,
  sliderPercent,
  toNativeOptions,
  turnedSize,
} from './adjust';

describe('adjustments', () => {
  it('treats the defaults as no change', () => {
    expect(isNeutral(NEUTRAL)).toBe(true);
    expect(isNeutral({ ...NEUTRAL, quarterTurns: 4 })).toBe(true);
    expect(isNeutral({ ...NEUTRAL, warmth: 0.1 })).toBe(false);
    expect(isNeutral({ ...NEUTRAL, aspect: 'square' })).toBe(false);
  });

  it('clamps and steps slider values', () => {
    expect(clampSlider('exposure', 9)).toBe(1.5);
    expect(clampSlider('saturation', -1)).toBe(0);
    expect(clampSlider('contrast', 1.0234)).toBe(1);
    expect(clampSlider('straighten', 3.3)).toBe(3.5);
  });

  it('shows slider values as signed percentages around neutral', () => {
    expect(sliderPercent('exposure', 0)).toBe('0');
    expect(sliderPercent('exposure', 1.5)).toBe('+100');
    expect(sliderPercent('saturation', 0)).toBe('-100');
    expect(sliderPercent('contrast', 1.2)).toBe('+50');
    expect(sliderPercent('straighten', -2.5)).toBe('-2.5°');
  });

  it('swaps width and height for odd quarter turns', () => {
    expect(turnedSize(4000, 3000, 1)).toEqual({ width: 3000, height: 4000 });
    expect(turnedSize(4000, 3000, 2)).toEqual({ width: 4000, height: 3000 });
    expect(turnedSize(4000, 3000, -1)).toEqual({ width: 3000, height: 4000 });
  });

  it('crops the largest centered area of the chosen shape', () => {
    expect(centeredCrop(4000, 3000, 'original')).toEqual({
      cropX: 0,
      cropY: 0,
      cropWidth: 1,
      cropHeight: 1,
    });
    const square = centeredCrop(4000, 3000, 'square');
    expect(square.cropWidth).toBeCloseTo(0.75);
    expect(square.cropX).toBeCloseTo(0.125);
    expect(square.cropHeight).toBe(1);
    const tall = centeredCrop(3000, 3000, '9:16');
    expect(tall.cropWidth).toBeCloseTo(9 / 16);
    const wide = centeredCrop(3000, 4000, '16:9');
    expect(wide.cropWidth).toBe(1);
    expect(wide.cropHeight * 4000 * (16 / 9)).toBeCloseTo(3000);
  });

  it('measures the crop after rotation', () => {
    // A landscape photo turned once is portrait; a 4:5 crop then trims height.
    const options = toNativeOptions(
      { ...NEUTRAL, quarterTurns: 1, aspect: '4:5' },
      4000,
      3000,
      2048,
    );
    expect(options.quarterTurns).toBe(1);
    expect(options.cropWidth).toBe(1);
    expect(options.cropHeight).toBeCloseTo(0.9375);
    expect(options.maxSide).toBe(2048);
  });
});
