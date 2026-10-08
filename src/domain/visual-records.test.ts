import { toPhotoItem, type PhotoItem, type PhotoRecord } from './media';
import {
  currentScores,
  isReusableVisual,
  rowFromNative,
  toScores,
  visualCoverage,
  type VisualRow,
} from './visual-records';

const IMPL = 'test/v1';

function photo(id: string, overrides: Partial<PhotoRecord> = {}): PhotoItem {
  return toPhotoItem({
    id,
    kind: 'photo',
    creationTime: 1,
    modificationTime: 100,
    width: 10,
    height: 10,
    durationMs: null,
    isFavorite: false,
    subtypes: [],
    filename: `${id}.HEIC`,
    ...overrides,
  });
}

const ok = {
  status: 'ok',
  featurePrint: [3, 4],
  sharpness: 100,
  sharpnessMaxTile: 500,
  brightness: 0.4,
  darkFraction: 0.1,
  brightFraction: 0.05,
  faces: [{ quality: 0.6, leftEyeOpen: 0.3, rightEyeOpen: 0.28, width: 0.2, height: 0.3 }],
};

test('a native result becomes a stored row and usable, normalized scores', () => {
  const row = rowFromNative({ id: 'a', ...ok }, photo('a'), IMPL, 7);
  expect(row).toMatchObject({
    status: 'ok',
    assetVersion: 100,
    implementation: IMPL,
    analyzedAt: 7,
  });
  const scores = toScores(row)!;
  expect(Array.from(scores.featurePrint!)).toEqual([expect.closeTo(0.6), expect.closeTo(0.8)]);
  expect(scores.faces).toHaveLength(1);
});

test('unknown or incomplete results are stored as failures, never as scores', () => {
  expect(rowFromNative({ id: 'a', status: 'weird' }, photo('a'), IMPL, 1).status).toBe('failed');
  const noSharpness = rowFromNative({ id: 'a', status: 'ok' }, photo('a'), IMPL, 1);
  expect(noSharpness.status).toBe('failed');
  expect(toScores(noSharpness)).toBeNull();
  expect(rowFromNative({ id: 'a', status: 'in-icloud' }, photo('a'), IMPL, 1).status).toBe(
    'in-icloud',
  );
});

test('changed photos, new implementations and iCloud skips are analyzed again', () => {
  const item = photo('a');
  const row = rowFromNative({ id: 'a', ...ok }, item, IMPL, 1);
  expect(isReusableVisual(row, item, IMPL)).toBe(true);
  expect(isReusableVisual(row, photo('a', { modificationTime: 101 }), IMPL)).toBe(false);
  expect(isReusableVisual(row, item, 'test/v2')).toBe(false);
  const cloud = rowFromNative({ id: 'a', status: 'in-icloud' }, item, IMPL, 1);
  expect(isReusableVisual(cloud, item, IMPL)).toBe(false);
});

test('coverage accounts for every analyzable photo; screenshots and videos are not counted', () => {
  const items = [
    photo('done'),
    photo('cloud'),
    photo('new'),
    photo('shot', { subtypes: ['screenshot'] }),
    photo('video', { kind: 'video', durationMs: 1 }),
  ];
  const rows = new Map<string, VisualRow>([
    ['done', rowFromNative({ id: 'done', ...ok }, items[0], IMPL, 1)],
    ['cloud', rowFromNative({ id: 'cloud', status: 'in-icloud' }, items[1], IMPL, 1)],
  ]);
  expect(visualCoverage(items, rows, IMPL)).toEqual({
    analyzed: 1,
    notAnalyzed: [
      { reason: 'in-icloud', count: 1 },
      { reason: 'not-yet', count: 1 },
    ],
  });
  expect([...currentScores(items, rows, IMPL).keys()]).toEqual(['done']);
});
