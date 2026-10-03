import {
  FINGERPRINT_IMPLEMENTATION,
  bytesEqual,
  candidateSets,
  confirmSet,
  confirmedSets,
  copyCoverage,
  exactCopyFindings,
  isReusable,
  metadataSkipReason,
  provesCameraOriginal,
  type FingerprintRow,
} from './exact-copies';
import { toPhotoItem, type PhotoItem, type PhotoRecord } from './media';

function item(id: string, overrides: Partial<PhotoRecord> = {}): PhotoItem {
  return toPhotoItem({
    id,
    kind: 'photo',
    creationTime: 1_750_000_000_000,
    modificationTime: 100,
    width: 4032,
    height: 3024,
    durationMs: null,
    isFavorite: false,
    subtypes: [],
    filename: `${id}.HEIC`,
    ...overrides,
  });
}

function hashed(assetId: string, overrides: Partial<FingerprintRow> = {}): FingerprintRow {
  return {
    assetId,
    assetVersion: 100,
    status: 'hashed',
    skipReason: null,
    implementation: FINGERPRINT_IMPLEMENTATION,
    byteSize: 1_800_000,
    digest: 'aaa',
    matchGroup: null,
    checkedAt: 1,
    ...overrides,
  };
}

describe('eligibility from metadata', () => {
  test('videos, Live Photos and nameless items are not checked, with a reason', () => {
    expect(metadataSkipReason(item('v', { kind: 'video', durationMs: 5000 }))).toBe('video');
    expect(metadataSkipReason(item('l', { subtypes: ['livePhoto'] }))).toBe('live-photo');
    expect(metadataSkipReason(item('n', { filename: null }))).toBe('no-filename');
    expect(metadataSkipReason(item('ok', { subtypes: ['hdr'] }))).toBeNull();
  });
});

describe('proving the camera original', () => {
  test('the unedited file in the camera roll with the same name passes (device evidence 1)', () => {
    expect(
      provesCameraOriginal('file:///var/mobile/Media/DCIM/100APPLE/IMG_0212.HEIC', 'IMG_0212.HEIC'),
    ).toBe(true);
    expect(
      provesCameraOriginal('file:///var/mobile/Media/DCIM/105APPLE/IMG_5001.JPG', 'IMG_5001.JPG'),
    ).toBe(true);
  });

  test('an edited rendition is rejected, even though its path mentions DCIM', () => {
    expect(
      provesCameraOriginal(
        'file:///var/mobile/Media/PhotoData/Mutations/DCIM/100APPLE/IMG_0212/Adjustments/FullSizeRender.HEIC',
        'IMG_0212.HEIC',
      ),
    ).toBe(false);
    expect(
      provesCameraOriginal(
        'file:///var/mobile/Media/PhotoData/Mutations/DCIM/100APPLE/IMG_0212.HEIC',
        'IMG_0212.HEIC',
      ),
    ).toBe(false);
  });

  test('a different name, folder or missing name is rejected', () => {
    const uri = 'file:///var/mobile/Media/DCIM/100APPLE/IMG_0212.HEIC';
    expect(provesCameraOriginal(uri, 'IMG_0213.HEIC')).toBe(false);
    expect(provesCameraOriginal(uri, 'img_0212.heic')).toBe(false);
    expect(provesCameraOriginal(uri, null)).toBe(false);
    expect(provesCameraOriginal('file:///private/var/tmp/IMG_0212.HEIC', 'IMG_0212.HEIC')).toBe(
      false,
    );
    expect(
      provesCameraOriginal('file:///var/mobile/Media/DCIM/IMG_0212.HEIC', 'IMG_0212.HEIC'),
    ).toBe(false);
  });

  test('percent-encoded names are compared decoded; malformed encoding fails safe', () => {
    expect(
      provesCameraOriginal('file:///var/mobile/Media/DCIM/100APPLE/My%20Photo.JPG', 'My Photo.JPG'),
    ).toBe(true);
    expect(provesCameraOriginal('file:///var/mobile/Media/DCIM/100APPLE/%E0%A4%A.JPG', 'x')).toBe(
      false,
    );
  });
});

describe('stored fingerprints', () => {
  test('a changed photo or a new implementation invalidates the fingerprint', () => {
    expect(isReusable(hashed('a'), item('a'))).toBe(true);
    expect(isReusable(hashed('a', { assetVersion: 99 }), item('a'))).toBe(false);
    expect(isReusable(hashed('a', { implementation: 'old' }), item('a'))).toBe(false);
  });

  test('stable skips are reused; iCloud and read errors are always rechecked', () => {
    const skip = (skipReason: FingerprintRow['skipReason']) =>
      hashed('a', { status: 'skipped', skipReason, digest: null, byteSize: null });
    expect(isReusable(skip('not-original-file'), item('a'))).toBe(true);
    expect(isReusable(skip('too-large'), item('a'))).toBe(true);
    expect(isReusable(skip('in-icloud'), item('a'))).toBe(false);
    expect(isReusable(skip('unreadable'), item('a'))).toBe(false);
  });
});

describe('candidates and confirmation', () => {
  test('only equal size and digest make a candidate set', () => {
    const rows = [
      hashed('a'),
      hashed('b'),
      hashed('c', { byteSize: 1_800_001 }),
      hashed('d', { digest: 'bbb' }),
      hashed('e', { status: 'skipped', skipReason: 'in-icloud', digest: null, byteSize: null }),
    ];
    expect(candidateSets(rows)).toEqual([['a', 'b']]);
  });

  test('a set is only confirmed by a byte comparison; a collision is dropped', async () => {
    // a, b, d are identical; c only shares the hash.
    const contents: Record<string, string> = { a: 'X', b: 'X', c: 'Y', d: 'X' };
    const compared: string[] = [];
    const identical = async (left: string, right: string) => {
      compared.push(`${left}=${right}`);
      return contents[left] === contents[right];
    };
    expect(await confirmSet(['a', 'b', 'c', 'd'], identical)).toEqual([['a', 'b', 'd']]);
    expect(compared).toEqual(['a=b', 'a=c', 'a=d']);
  });

  test('two different identical pairs under one hash stay separate sets', async () => {
    const contents: Record<string, string> = { a: 'X', b: 'Y', c: 'X', d: 'Y' };
    const sets = await confirmSet(
      ['a', 'b', 'c', 'd'],
      async (left, right) => contents[left] === contents[right],
    );
    expect(sets).toEqual([
      ['a', 'c'],
      ['b', 'd'],
    ]);
  });

  test('bytesEqual compares every byte', () => {
    expect(bytesEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3]))).toBe(true);
    expect(bytesEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 4]))).toBe(false);
    expect(bytesEqual(new Uint8Array([1, 2]), new Uint8Array([1, 2, 3]))).toBe(false);
  });

  test('stored sets only count members that haven’t changed since', () => {
    const items = [item('a'), item('b'), item('c', { modificationTime: 200 })];
    const byId = new Map(items.map((entry) => [entry.id, entry]));
    const rows = [
      hashed('a', { matchGroup: 'a' }),
      hashed('b', { matchGroup: 'a' }),
      hashed('c', { matchGroup: 'a' }), // c was edited after the check
    ];
    expect(confirmedSets(rows, byId)).toEqual([['a', 'b']]);
    // If only one current member remains, there is no set.
    expect(confirmedSets([rows[0], rows[2]], byId)).toEqual([]);
  });
});

describe('findings', () => {
  test('keeper is a favorite if any, otherwise the earliest; favorites stay keepers', () => {
    const items = [
      item('late', { creationTime: 3 }),
      item('early', { creationTime: 1 }),
      item('fav', { creationTime: 2, isFavorite: true }),
    ];
    const byId = new Map(items.map((entry) => [entry.id, entry]));
    const [withFavorite] = exactCopyFindings([['late', 'early', 'fav']], byId);
    expect(withFavorite.category).toBe('exact');
    expect(withFavorite.keeperId).toBe('fav');
    expect(withFavorite.memberIds).toEqual(['early', 'fav', 'late']);

    const [plain] = exactCopyFindings([['late', 'early']], byId);
    expect(plain.keeperId).toBe('early');
    expect(plain.keeperReason).toMatch(/identical byte for byte/);
  });

  test('a set whose members left the catalog yields nothing', () => {
    expect(exactCopyFindings([['gone', 'also-gone']], new Map())).toEqual([]);
  });
});

describe('coverage', () => {
  test('every photo is either checked or not checked with a reason', () => {
    const items = [
      item('hashed'),
      item('edited'),
      item('cloud'),
      item('new'),
      item('changed', { modificationTime: 999 }),
      item('live', { subtypes: ['livePhoto'] }),
      item('video', { kind: 'video', durationMs: 1000 }),
    ];
    const rows = new Map(
      [
        hashed('hashed', { matchGroup: 'hashed' }),
        hashed('edited', { status: 'skipped', skipReason: 'not-original-file', digest: null }),
        hashed('cloud', { status: 'skipped', skipReason: 'in-icloud', digest: null }),
        hashed('changed'),
      ].map((row) => [row.assetId, row]),
    );
    const coverage = copyCoverage(items, rows, []);
    expect(coverage.checked).toBe(1);
    const reasons = Object.fromEntries(
      coverage.notChecked.map((entry) => [entry.reason, entry.count]),
    );
    expect(reasons).toEqual({
      'not-original-file': 1,
      'in-icloud': 1,
      'not-yet': 2,
      'live-photo': 1,
      video: 1,
    });
    const total =
      coverage.checked + coverage.notChecked.reduce((sum, entry) => sum + entry.count, 0);
    expect(total).toBe(items.length);
  });
});
