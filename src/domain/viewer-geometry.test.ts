import {
  DISMISS_DISTANCE,
  DISMISS_VELOCITY,
  IDENTITY,
  dragProgress,
  fitRect,
  mixTransform,
  panLimits,
  photoScaleInMask,
  shouldDismiss,
  tileTransform,
  zoomAbout,
} from './viewer-geometry';

describe('fitRect', () => {
  test('a landscape photo fills the width and is centered vertically', () => {
    expect(fitRect(4000, 3000, 400, 800)).toEqual({ x: 0, y: 250, width: 400, height: 300 });
  });

  test('a tall photo fills the height and is centered horizontally', () => {
    expect(fitRect(1000, 4000, 400, 800)).toEqual({ x: 100, y: 0, width: 200, height: 800 });
  });

  test('unknown dimensions fall back to a square', () => {
    expect(fitRect(0, 0, 400, 800)).toEqual({ x: 0, y: 200, width: 400, height: 400 });
  });
});

describe('tileTransform', () => {
  const fit = fitRect(4000, 3000, 400, 800); // 400×300 at (0, 250)
  const tile = { x: 10, y: 100, width: 100, height: 100 };
  const t = tileTransform(fit, tile, 400, 800);

  test('the full-screen mask shrinks to the tile’s size and position', () => {
    expect(400 * t.maskScaleX).toBeCloseTo(tile.width);
    expect(800 * t.maskScaleY).toBeCloseTo(tile.height);
    const centerX = 200 + t.translateX;
    const centerY = 400 + t.translateY;
    expect(centerX).toBeCloseTo(tile.x + tile.width / 2);
    expect(centerY).toBeCloseTo(tile.y + tile.height / 2);
  });

  test('the photo covers the tile without distortion, like the grid crop', () => {
    // Effective photo size = fit size × photoScale; it must cover the tile.
    expect(fit.width * t.photoScale).toBeGreaterThanOrEqual(tile.width - 1e-9);
    expect(fit.height * t.photoScale).toBeCloseTo(tile.height);
  });

  test('inside the mask the photo is counter-scaled to stay undistorted', () => {
    const inner = photoScaleInMask(t);
    expect(t.maskScaleX * inner.x).toBeCloseTo(t.photoScale);
    expect(t.maskScaleY * inner.y).toBeCloseTo(t.photoScale);
  });

  test('mixing reaches the tile at 0 and identity at 1', () => {
    expect(mixTransform(t, IDENTITY, 0)).toEqual(t);
    expect(mixTransform(t, IDENTITY, 1)).toEqual(IDENTITY);
  });
});

describe('dismissal', () => {
  test('a short slow drag springs back', () => {
    expect(shouldDismiss(DISMISS_DISTANCE - 1, 100)).toBe(false);
  });

  test('a long drag or a fast flick dismisses, in either direction', () => {
    expect(shouldDismiss(DISMISS_DISTANCE + 1, 0)).toBe(true);
    expect(shouldDismiss(-DISMISS_DISTANCE - 1, 0)).toBe(true);
    expect(shouldDismiss(20, DISMISS_VELOCITY + 1)).toBe(true);
    expect(shouldDismiss(-20, -DISMISS_VELOCITY - 1)).toBe(true);
  });

  test('backdrop progress is capped at 1', () => {
    expect(dragProgress(0, 800)).toBe(0);
    expect(dragProgress(200, 800)).toBe(0.5);
    expect(dragProgress(-2000, 800)).toBe(1);
  });
});

describe('zoom', () => {
  test('no panning while the zoomed photo still fits', () => {
    const fit = fitRect(4000, 3000, 400, 800);
    expect(panLimits(fit, 1, 400, 800)).toEqual({ x: 0, y: 0 });
    expect(panLimits(fit, 2, 400, 800)).toEqual({ x: 200, y: 0 });
  });

  test('zooming keeps the point under the fingers in place', () => {
    // A point 100 pt right of center, no prior offset, zoom 1 → 2.
    const offset = zoomAbout(100, 0, 1, 2);
    // Photo-local point q = (focal - offset) / zoom stays the same.
    expect((100 - offset) / 2).toBeCloseTo((100 - 0) / 1);
  });
});
