import { candidateIds } from './findings';
import { toPhotoItem, type PhotoRecord } from './media';
import { favoriteIds, findLongVideos, findMoments, findScreenshots } from './real-findings';

const t0 = Date.UTC(2026, 8, 27, 19, 0, 0);

function photo(id: string, offsetMs: number, overrides: Partial<PhotoRecord> = {}) {
  return toPhotoItem({
    id,
    kind: 'photo',
    creationTime: t0 + offsetMs,
    modificationTime: 1,
    width: 4032,
    height: 3024,
    durationMs: null,
    isFavorite: false,
    subtypes: [],
    filename: null,
    ...overrides,
  });
}

describe('findMoments', () => {
  test('chains photos taken within the gap and with identical dimensions', () => {
    const items = [photo('a', 0), photo('b', 1500), photo('c', 3000), photo('d', 60_000)];
    const [group] = findMoments(items);
    expect(group.memberIds).toEqual(['a', 'b', 'c']);
    expect(group.category).toBe('moments');
  });

  test('a single photo, a big gap or different dimensions break a moment', () => {
    expect(findMoments([photo('a', 0)])).toEqual([]);
    expect(findMoments([photo('a', 0), photo('b', 2001)])).toEqual([]);
    expect(findMoments([photo('a', 0), photo('b', 500, { width: 3024, height: 4032 })])).toEqual(
      [],
    );
  });

  test('screenshots, videos and undated photos are never part of a moment', () => {
    const items = [
      photo('a', 0, { subtypes: ['screenshot'] }),
      photo('b', 500, { kind: 'video', durationMs: 4000 }),
      photo('c', 700, { creationTime: null }),
      photo('d', 900),
    ];
    expect(findMoments(items)).toEqual([]);
  });

  test('without quality analysis the keeper is the first shot, and the reason says so', () => {
    const [group] = findMoments([photo('a', 0), photo('b', 1000)]);
    expect(group.keeperId).toBe('a');
    expect(group.keeperReason).toMatch(/can’t judge sharpness/);
  });

  test('a favorite becomes the keeper', () => {
    const [group] = findMoments([photo('a', 0), photo('b', 1000, { isFavorite: true })]);
    expect(group.keeperId).toBe('b');
    expect(group.keeperReason).toBe('Marked as a favorite in Photos');
  });

  test('input order does not matter and newest moments come first', () => {
    const items = [photo('late2', 90_000), photo('a', 0), photo('late1', 89_500), photo('b', 800)];
    expect(findMoments(items).map((group) => group.memberIds)).toEqual([
      ['late1', 'late2'],
      ['a', 'b'],
    ]);
  });
});

test('screenshots are found by their Photos subtype', () => {
  const items = [photo('a', 0, { subtypes: ['screenshot'] }), photo('b', 10)];
  expect(findScreenshots(items).map((finding) => finding.assetId)).toEqual(['a']);
});

test('long videos are at least a minute, longest first', () => {
  const items = [
    photo('short', 0, { kind: 'video', durationMs: 59_000 }),
    photo('long', 0, { kind: 'video', durationMs: 61_000 }),
    photo('longer', 0, { kind: 'video', durationMs: 600_000 }),
  ];
  expect(findLongVideos(items).map((finding) => finding.assetId)).toEqual(['longer', 'long']);
  expect(findLongVideos(items)[0].reason).toBe('Video, 10:00');
});

test('favorites are never removal candidates', () => {
  const items = [
    photo('a', 0),
    photo('b', 1000, { isFavorite: false }),
    photo('c', 1500, { isFavorite: true }),
  ];
  const [group] = findMoments(items);
  const protectedIds = favoriteIds(items);
  expect(candidateIds(group, { protectedIds })).toEqual(['a', 'b']);
});
