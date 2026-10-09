import { clampTrim, formatSeconds, isTrimmed, sizeChange, slideshowSeconds } from './video';

describe('video helpers', () => {
  it('clamps trims to the video', () => {
    expect(clampTrim(-3, 99, 20)).toEqual({ start: 0, end: 20 });
    expect(clampTrim(5, 12.34, 20)).toEqual({ start: 5, end: 12.3 });
  });

  it('keeps a clip at least one second long', () => {
    expect(clampTrim(10, 10.2, 20)).toEqual({ start: 10, end: 11 });
    expect(clampTrim(19.8, 20, 20)).toEqual({ start: 19, end: 20 });
    expect(clampTrim(0, 0.2, 0.5)).toEqual({ start: 0, end: 0.5 });
  });

  it('knows whether a range trims anything', () => {
    expect(isTrimmed({ start: 0, end: 20 }, 20)).toBe(false);
    expect(isTrimmed({ start: 0.5, end: 20 }, 20)).toBe(true);
    expect(isTrimmed({ start: 0, end: 18 }, 20)).toBe(true);
  });

  it('formats seconds for trim handles', () => {
    expect(formatSeconds(0)).toBe('0:00.0');
    expect(formatSeconds(65.34)).toBe('1:05.3');
  });

  it('reports size changes only against a measured source', () => {
    expect(sizeChange(null, 100)).toEqual({ kind: 'unknown' });
    expect(sizeChange(1000, 1000)).toEqual({ kind: 'not-smaller' });
    expect(sizeChange(1000, 250)).toEqual({ kind: 'smaller', percent: 75 });
  });

  it('computes slideshow length', () => {
    expect(slideshowSeconds(10, 3.5)).toBe(35);
  });
});
