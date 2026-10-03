import { describeDifferences, type ComparablePhoto } from './compare';

const keeper: ComparablePhoto = {
  id: 'k',
  capturedAt: '2026-09-27T19:42:10-04:00',
  width: 4032,
  height: 3024,
  bytes: 3_840_000,
};

test('the keeper describes itself', () => {
  expect(describeDifferences(keeper, keeper)).toEqual(['This is the keeper']);
});

test('time, size and dimensions are explained relative to the keeper', () => {
  expect(
    describeDifferences(
      { ...keeper, id: 'p', capturedAt: '2026-09-27T19:42:14-04:00', bytes: 3_610_000 },
      keeper,
    ),
  ).toEqual(['4 s later', '230 KB smaller', 'Same dimensions']);
});

test('earlier photos, larger files and different sizes read naturally', () => {
  expect(
    describeDifferences(
      {
        id: 'p',
        capturedAt: '2026-09-27T17:42:10-04:00',
        width: 3024,
        height: 4032,
        bytes: 5_040_000,
      },
      keeper,
    ),
  ).toEqual(['2 h earlier', '1.2 MB larger', '3024 × 4032 vs 4032 × 3024']);
});

test('identical copies say so', () => {
  expect(describeDifferences({ ...keeper, id: 'copy' }, keeper)).toEqual([
    'Taken at the same moment',
    'Same file size',
    'Same dimensions',
  ]);
});
