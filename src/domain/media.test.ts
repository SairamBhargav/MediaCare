import { describeRecord, formatDuration, toLocalIso, toPhotoItem, type PhotoRecord } from './media';

const base: PhotoRecord = {
  id: 'A1/L0/001',
  kind: 'photo',
  creationTime: Date.UTC(2026, 8, 27, 23, 42, 10),
  modificationTime: 1,
  width: 4032,
  height: 3024,
  durationMs: null,
  isFavorite: false,
  subtypes: [],
  filename: 'IMG_0001.HEIC',
};

test('toLocalIso writes the wall clock in the given zone with its offset', () => {
  const instant = Date.UTC(2026, 8, 27, 23, 42, 10);
  expect(toLocalIso(instant, -240)).toBe('2026-09-27T19:42:10-04:00');
  expect(toLocalIso(instant, 540)).toBe('2026-09-28T08:42:10+09:00');
  expect(toLocalIso(instant, 330)).toBe('2026-09-28T05:12:10+05:30');
  expect(toLocalIso(instant, 0)).toBe('2026-09-27T23:42:10+00:00');
});

test('real photos never claim a measured size and record where the date came from', () => {
  const item = toPhotoItem(base);
  expect(item.bytes).toBeNull();
  expect(item.dateSource).toBe('photos-creation-time');
  expect(toPhotoItem({ ...base, creationTime: null })).toMatchObject({
    capturedAt: null,
    dateSource: 'unknown',
  });
});

test('missing dimensions become 0 rather than a guess', () => {
  expect(toPhotoItem({ ...base, width: null, height: null })).toMatchObject({
    width: 0,
    height: 0,
  });
});

test('descriptions say what the item is', () => {
  expect(describeRecord({ ...base, subtypes: ['screenshot'] })).toMatch(/^Screenshot, /);
  expect(describeRecord({ ...base, kind: 'video', durationMs: 72_000 })).toMatch(/^Video, 1:12, /);
  expect(describeRecord({ ...base, creationTime: null })).toBe('Photo, no date');
});

test('formatDuration', () => {
  expect(formatDuration(5_000)).toBe('0:05');
  expect(formatDuration(3_725_000)).toBe('1:02:05');
});
