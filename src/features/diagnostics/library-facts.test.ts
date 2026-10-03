import { toPhotoItem, type PhotoRecord } from '@/domain/media';

import { extensionOf, formatFacts, libraryFacts } from './library-facts';

function item(overrides: Partial<PhotoRecord>) {
  return toPhotoItem({
    id: Math.random().toString(36),
    kind: 'photo',
    creationTime: 1,
    modificationTime: 1,
    width: 1,
    height: 1,
    durationMs: null,
    isFavorite: false,
    subtypes: [],
    filename: 'IMG_0001.HEIC',
    ...overrides,
  });
}

test('extensionOf normalizes case and handles missing names', () => {
  expect(extensionOf('IMG_1.heic')).toBe('HEIC');
  expect(extensionOf('noextension')).toBe('none');
  expect(extensionOf(null)).toBe('unknown');
});

test('facts count kinds, favorites, undated items, subtypes and file types', () => {
  const facts = libraryFacts([
    item({}),
    item({ filename: 'IMG_2.JPG', isFavorite: true }),
    item({ kind: 'video', filename: 'IMG_3.MOV', durationMs: 5000 }),
    item({ subtypes: ['screenshot'], filename: 'IMG_4.PNG', creationTime: null }),
    item({ subtypes: ['livePhoto'] }),
  ]);
  expect(facts).toMatchObject({ total: 5, photos: 4, videos: 1, favorites: 1, undated: 1 });
  expect(facts.byExtension).toEqual({ HEIC: 2, JPG: 1, MOV: 1, PNG: 1 });
  expect(facts.bySubtype).toEqual({ screenshot: 1, livePhoto: 1 });
  expect(formatFacts(facts)).toContain('File types (by name): HEIC 2');
});
