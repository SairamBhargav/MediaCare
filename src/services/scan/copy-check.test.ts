import {
  FINGERPRINT_IMPLEMENTATION,
  MAX_FINGERPRINT_BYTES,
  type FingerprintRow,
} from '@/domain/exact-copies';
import { reduceJob, startJob, type Job, type JobEvent } from '@/domain/jobs';
import { toPhotoItem, type PhotoItem, type PhotoRecord } from '@/domain/media';

import { runCopyCheck, type CopyCheckDeps } from './copy-check';

function photo(id: string, overrides: Partial<PhotoRecord> = {}): PhotoItem {
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

const original = (id: string) => `file:///var/mobile/Media/DCIM/100APPLE/${id}.HEIC`;

type FakeFile = { bytes: string; inCloud?: boolean; uri?: string };

function setup(files: Record<string, FakeFile>, items: PhotoItem[], stored: FingerprintRow[] = []) {
  const saved: FingerprintRow[] = [];
  let matchGroups: (readonly string[])[] = [];
  const calls = { resolve: [] as string[], md5: [] as string[], compare: [] as string[] };
  const contentAt = (uri: string) =>
    Object.entries(files).find(([id, file]) => (file.uri ?? original(id)) === uri)?.[1].bytes;

  const deps: CopyCheckDeps = {
    listItems: async () => items,
    loadFingerprints: async () => stored,
    isInCloud: async (id) => files[id]?.inCloud ?? false,
    resolveUri: async (id) => {
      calls.resolve.push(id);
      return files[id]?.uri ?? original(id);
    },
    fileSize: (uri) => {
      const bytes = contentAt(uri);
      return bytes === undefined ? null : bytes === 'HUGE' ? MAX_FINGERPRINT_BYTES + 1 : 1000;
    },
    fileMd5: (uri) => {
      calls.md5.push(uri);
      const bytes = contentAt(uri);
      // A deliberately weak "hash": X and Y collide, so only the byte check separates them.
      return bytes === undefined ? null : bytes === 'Y' ? 'md5-X' : `md5-${bytes}`;
    },
    sameBytes: async (a, b) => {
      calls.compare.push(`${a.split('/').pop()}=${b.split('/').pop()}`);
      return contentAt(a) === contentAt(b);
    },
    saveFingerprints: async (rows) => {
      saved.push(...rows);
    },
    saveMatchGroups: async (sets) => {
      matchGroups = [...sets];
    },
    checkpoint: async () => {},
    now: () => 42,
  };

  let job: Job = startJob('copy-check', false);
  const emit = (event: JobEvent) => {
    job = reduceJob(job, event);
  };
  return { deps, emit, saved, calls, groups: () => matchGroups, job: () => job };
}

test('finds identical camera originals and confirms them byte for byte', async () => {
  const items = [photo('a'), photo('b'), photo('c')];
  const t = setup({ a: { bytes: 'X' }, b: { bytes: 'X' }, c: { bytes: 'Z' } }, items);
  const outcome = await runCopyCheck(t.deps, t.emit).done;

  expect(outcome).toBe('succeeded');
  expect(t.groups()).toEqual([['a', 'b']]);
  expect(t.calls.compare).toEqual(['a.HEIC=b.HEIC']);
  expect(t.job()).toMatchObject({ status: 'succeeded', processed: 3, total: 3 });
  expect(t.saved.every((row) => row.implementation === FINGERPRINT_IMPLEMENTATION)).toBe(true);
});

test('a hash collision is not called an exact copy', async () => {
  const items = [photo('a'), photo('b')];
  const t = setup({ a: { bytes: 'X' }, b: { bytes: 'Y' } }, items);
  await runCopyCheck(t.deps, t.emit).done;
  expect(t.calls.compare).toHaveLength(1);
  expect(t.groups()).toEqual([]);
});

test('ineligible photos are never read and each gets a reason', async () => {
  const items = [
    photo('live', { subtypes: ['livePhoto'] }),
    photo('video', { kind: 'video', durationMs: 4000 }),
    photo('cloud'),
    photo('edited'),
    photo('huge'),
    photo('ok'),
  ];
  const t = setup(
    {
      live: { bytes: 'X' },
      video: { bytes: 'X' },
      cloud: { bytes: 'X', inCloud: true },
      edited: {
        bytes: 'X',
        uri: 'file:///var/mobile/Media/PhotoData/Mutations/DCIM/100APPLE/IMG_1/Adjustments/FullSizeRender.HEIC',
      },
      huge: { bytes: 'HUGE' },
      ok: { bytes: 'X' },
    },
    items,
  );
  await runCopyCheck(t.deps, t.emit).done;

  const reasons = Object.fromEntries(t.saved.map((row) => [row.assetId, row.skipReason]));
  expect(reasons).toEqual({
    cloud: 'in-icloud',
    edited: 'not-original-file',
    huge: 'too-large',
    ok: null,
  });
  // Live Photos and videos are decided from metadata: no file is touched.
  expect(t.calls.resolve).not.toContain('live');
  expect(t.calls.resolve).not.toContain('video');
  // iCloud-only photos are never resolved (resolving can download).
  expect(t.calls.resolve).not.toContain('cloud');
  // Only the eligible original was hashed; the oversized file wasn't.
  expect(t.calls.md5).toEqual([original('ok')]);
  expect(t.job().total).toBe(4);
});

test('current fingerprints are reused; changed photos are checked again', async () => {
  const stored: FingerprintRow[] = [
    {
      assetId: 'a',
      assetVersion: 100,
      status: 'hashed',
      skipReason: null,
      implementation: FINGERPRINT_IMPLEMENTATION,
      byteSize: 1000,
      digest: 'md5-X',
      matchGroup: null,
      checkedAt: 1,
    },
    {
      assetId: 'b',
      assetVersion: 50, // b changed since
      status: 'hashed',
      skipReason: null,
      implementation: FINGERPRINT_IMPLEMENTATION,
      byteSize: 1000,
      digest: 'md5-X',
      matchGroup: null,
      checkedAt: 1,
    },
  ];
  const t = setup({ a: { bytes: 'X' }, b: { bytes: 'X' } }, [photo('a'), photo('b')], stored);
  await runCopyCheck(t.deps, t.emit).done;
  expect(t.calls.md5).toEqual([original('b')]);
  expect(t.saved.map((row) => row.assetId)).toEqual(['b']);
  expect(t.groups()).toEqual([['a', 'b']]);
});

test('stop keeps the fingerprints taken so far and saves no sets', async () => {
  const items = Array.from({ length: 6 }, (_, index) => photo(`p${index}`));
  const files = Object.fromEntries(items.map((item) => [item.id, { bytes: 'X' }]));
  const t = setup(files, items);
  const checkpoints: { status: string; processed: number }[] = [];
  const controls = runCopyCheck(
    {
      ...t.deps,
      saveFingerprints: async (rows) => {
        await t.deps.saveFingerprints(rows);
        controls.cancel(); // Stop pressed while the first batch is being written.
      },
      checkpoint: async ({ status, processed }) => {
        checkpoints.push({ status, processed });
      },
    },
    t.emit,
    { batchSize: 2 },
  );

  expect(await controls.done).toBe('canceled');
  expect(t.saved).toHaveLength(2);
  expect(t.groups()).toEqual([]);
  expect(t.job().status).toBe('canceled');
  expect(checkpoints.at(-1)).toEqual({ status: 'canceled', processed: 2 });
});

test('pause waits between photos and resume continues', async () => {
  const items = [photo('a'), photo('b')];
  const t = setup({ a: { bytes: 'X' }, b: { bytes: 'X' } }, items);
  const controls = runCopyCheck(t.deps, t.emit);
  controls.pause();
  await new Promise((resolve) => setTimeout(resolve, 10));
  expect(t.job().status).toBe('paused');
  expect(t.calls.md5).toHaveLength(0);
  controls.resume();
  expect(await controls.done).toBe('succeeded');
  expect(t.groups()).toEqual([['a', 'b']]);
});

test('a photo that changed into a rendition before confirmation is not matched', async () => {
  const items = [photo('a'), photo('b')];
  const files: Record<string, FakeFile> = { a: { bytes: 'X' }, b: { bytes: 'X' } };
  const t = setup(files, items);
  let resolves = 0;
  const deps: CopyCheckDeps = {
    ...t.deps,
    resolveUri: async (id) => {
      resolves += 1;
      // During grouping, b now resolves to an edited rendition.
      return resolves > 2 && id === 'b'
        ? 'file:///var/mobile/Media/PhotoData/Mutations/DCIM/100APPLE/b/Adjustments/FullSizeRender.HEIC'
        : original(id);
    },
  };
  await runCopyCheck(deps, t.emit).done;
  expect(t.groups()).toEqual([]);
});
