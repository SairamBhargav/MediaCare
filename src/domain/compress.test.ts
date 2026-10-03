import { capLongEdge, compressToTarget, savings, type EncodeFn } from './compress';

/** Fake encoder: size grows with quality and with pixel count. */
function fakeEncoder(bytesAtFullQualityFullSize: number, sourceLongEdge: number) {
  const calls: { quality: number; longEdge: number }[] = [];
  const encode: EncodeFn = async (quality, longEdge) => {
    calls.push({ quality, longEdge });
    const area = (longEdge / sourceLongEdge) ** 2;
    const bytes = Math.round(bytesAtFullQualityFullSize * area * (0.15 + 0.85 * quality));
    return {
      uri: `file://${quality}-${longEdge}`,
      bytes,
      width: longEdge,
      height: Math.round(longEdge * 0.75),
      quality,
      longEdge,
    };
  };
  return { encode, calls };
}

test('capLongEdge resizes only images that are larger than the cap', () => {
  expect(capLongEdge(4032, 3024, 2048)).toEqual({ width: 2048 });
  expect(capLongEdge(3024, 4032, 2048)).toEqual({ height: 2048 });
  expect(capLongEdge(1200, 900, 2048)).toBeNull();
});

test('a photo already under the target keeps the top quality in one encode', async () => {
  const { encode, calls } = fakeEncoder(800_000, 4032);
  const result = await compressToTarget({
    targetBytes: 1_000_000,
    sourceLongEdge: 4032,
    allowResize: false,
    encode,
  });
  expect(result.status).toBe('fits');
  expect(calls).toHaveLength(1);
});

test('finds the highest quality that fits, within the attempt budget', async () => {
  const { encode, calls } = fakeEncoder(4_000_000, 4032);
  const result = await compressToTarget({
    targetBytes: 2_000_000,
    sourceLongEdge: 4032,
    allowResize: false,
    encode,
  });
  expect(result.status).toBe('fits');
  if (result.status !== 'fits') return;
  expect(result.best.bytes).toBeLessThanOrEqual(2_000_000);
  expect(result.best.longEdge).toBe(4032);
  // A slightly higher quality would not fit: within 0.05 of the true limit (~0.41).
  expect(result.best.quality).toBeGreaterThan(0.36);
  expect(calls.length).toBeLessThanOrEqual(6);
});

test('without permission to resize, an impossible target is reported, not overshot', async () => {
  const { encode, calls } = fakeEncoder(20_000_000, 4032);
  const result = await compressToTarget({
    targetBytes: 1_000_000,
    sourceLongEdge: 4032,
    allowResize: false,
    encode,
  });
  expect(result.status).toBe('not-achievable');
  expect(calls.every((call) => call.longEdge === 4032)).toBe(true);
});

test('with permission, dimensions shrink in steps but never below the minimum', async () => {
  const { encode, calls } = fakeEncoder(20_000_000, 4032);
  const result = await compressToTarget({
    targetBytes: 1_000_000,
    sourceLongEdge: 4032,
    allowResize: true,
    encode,
  });
  expect(result.status).toBe('fits');
  if (result.status !== 'fits') return;
  expect(result.best.longEdge).toBeLessThan(4032);
  expect(result.best.longEdge).toBeGreaterThanOrEqual(1080);
  expect(calls.every((call) => call.longEdge >= 1080)).toBe(true);
});

test('even resizing can fail; the smallest attempt is returned for explanation', async () => {
  const { encode } = fakeEncoder(500_000_000, 4032);
  const result = await compressToTarget({
    targetBytes: 100_000,
    sourceLongEdge: 4032,
    allowResize: true,
    encode,
  });
  expect(result.status).toBe('not-achievable');
  if (result.status !== 'not-achievable') return;
  expect(result.smallest.bytes).toBeGreaterThan(100_000);
});

test('rejects a non-positive target', async () => {
  const { encode } = fakeEncoder(1, 1);
  await expect(
    compressToTarget({ targetBytes: 0, sourceLongEdge: 1, allowResize: false, encode }),
  ).rejects.toThrow(RangeError);
});

test('savings never calls a bigger copy an optimization', () => {
  expect(savings(4_000_000, 1_000_000)).toEqual({ kind: 'smaller', saved: 3_000_000, percent: 75 });
  expect(savings(1_000_000, 1_200_000)).toEqual({ kind: 'not-smaller', extra: 200_000 });
  expect(savings(null, 1_000)).toEqual({ kind: 'unknown' });
});
