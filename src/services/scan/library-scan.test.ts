import type { AssetMetadata } from 'expo-media-library';

import { reduceJob, startJob, type Job } from '@/domain/jobs';
import type { PhotoRecord } from '@/domain/media';

import { runLibraryScan, type LibraryScanDeps } from './library-scan';

jest.mock('expo-media-library', () => ({}));

function meta(id: string, modificationTime = 1): AssetMetadata {
  return {
    id,
    filename: `${id}.HEIC`,
    mediaType: 'image',
    width: 4032,
    height: 3024,
    duration: null,
    creationTime: 1_000_000 - Number(id.replace(/\D/g, '')),
    modificationTime,
    isFavorite: false,
  } as AssetMetadata;
}

function fakeDeps(library: AssetMetadata[], existing = new Map<string, number | null>()) {
  const catalog = new Map<string, { record: PhotoRecord; scan: string }>();
  for (const [id, version] of existing) {
    catalog.set(id, {
      record: {
        id,
        kind: 'photo',
        creationTime: 0,
        modificationTime: version,
        width: 1,
        height: 1,
        durationMs: null,
        isFavorite: false,
        subtypes: [],
        filename: null,
      },
      scan: 'old',
    });
  }
  const checkpoints: string[] = [];
  const subtypeCalls: string[] = [];
  const deps: LibraryScanDeps = {
    listAllMetadata: async (_onPage, shouldStop) => (shouldStop() ? [] : library),
    getSubtypes: async (id) => {
      subtypeCalls.push(id);
      return id === 'p2' ? ['screenshot'] : [];
    },
    toRecord: (item, subtypes) => ({
      id: item.id,
      kind: 'photo',
      creationTime: item.creationTime,
      modificationTime: item.modificationTime,
      width: item.width,
      height: item.height,
      durationMs: item.duration,
      isFavorite: item.isFavorite,
      subtypes,
      filename: item.filename,
    }),
    loadVersions: async () =>
      new Map([...catalog].map(([id, row]) => [id, row.record.modificationTime])),
    upsertAssets: async (records, scan) => {
      for (const record of records) catalog.set(record.id, { record, scan });
    },
    markSeen: async (ids, scan) => {
      for (const id of ids) {
        const row = catalog.get(id);
        if (row) row.scan = scan;
      }
    },
    removeUnseen: async (scan) => {
      let removed = 0;
      for (const [id, row] of catalog) {
        if (row.scan !== scan) {
          catalog.delete(id);
          removed += 1;
        }
      }
      return removed;
    },
    checkpoint: async (state) => {
      checkpoints.push(state.status);
    },
  };
  return { deps, catalog, checkpoints, subtypeCalls };
}

function track() {
  let job: Job = startJob('scan', false);
  return {
    emit: (event: Parameters<typeof reduceJob>[1]) => (job = reduceJob(job, event)),
    job: () => job,
  };
}

const library = Array.from({ length: 250 }, (_, index) => meta(`p${index}`));

test('a full scan catalogs everything with subtypes and reports honest progress', async () => {
  const { deps, catalog, checkpoints } = fakeDeps(library);
  const tracker = track();
  const controls = runLibraryScan('s1', deps, tracker.emit, { batchSize: 100 });
  expect(await controls.done).toBe('succeeded');
  expect(tracker.job()).toMatchObject({ status: 'succeeded', processed: 250, total: 250 });
  expect(catalog.size).toBe(250);
  expect(catalog.get('p2')?.record.subtypes).toEqual(['screenshot']);
  expect(checkpoints.at(-1)).toBe('succeeded');
});

test('a rescan only reads subtypes for new or changed assets', async () => {
  const existing = new Map<string, number | null>(library.map((item) => [item.id, 1]));
  const changedLibrary = library.map((item, index) => (index === 7 ? meta(item.id, 2) : item));
  const { deps, subtypeCalls } = fakeDeps([...changedLibrary, meta('p999')], existing);
  await runLibraryScan('s2', deps, track().emit).done;
  expect(subtypeCalls.sort()).toEqual(['p7', 'p999']);
});

test('a complete scan drops assets no longer in Photos', async () => {
  const existing = new Map<string, number | null>([['gone', 1]]);
  const { deps, catalog } = fakeDeps(library.slice(0, 5), existing);
  await runLibraryScan('s3', deps, track().emit).done;
  expect(catalog.has('gone')).toBe(false);
  expect(catalog.size).toBe(5);
});

test('stopping keeps what was written and never drops existing rows', async () => {
  const existing = new Map<string, number | null>([['old-photo', 1]]);
  const { deps, catalog, checkpoints } = fakeDeps(library, existing);
  const tracker = track();
  const controls = runLibraryScan('s4', deps, tracker.emit, { batchSize: 100 });
  // Let the first batch land, then stop.
  await new Promise((resolve) => setTimeout(resolve, 5));
  controls.cancel();
  expect(await controls.done).toBe('canceled');
  expect(tracker.job().status).toBe('canceled');
  expect(catalog.has('old-photo')).toBe(true);
  expect(checkpoints.at(-1)).toBe('canceled');
});

test('pause holds the scan until resume', async () => {
  const { deps } = fakeDeps(library);
  const tracker = track();
  const controls = runLibraryScan('s5', deps, tracker.emit, { batchSize: 50 });
  controls.pause();
  await new Promise((resolve) => setTimeout(resolve, 20));
  const atPause = tracker.job().processed;
  expect(tracker.job().status).toBe('paused');
  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(tracker.job().processed).toBe(atPause);
  controls.resume();
  expect(await controls.done).toBe('succeeded');
  expect(tracker.job().processed).toBe(250);
});

test('errors end the job as failed with the message, not as success', async () => {
  const { deps } = fakeDeps(library);
  deps.upsertAssets = async () => {
    throw new Error('Disk full');
  };
  const tracker = track();
  expect(await runLibraryScan('s6', deps, tracker.emit).done).toBe('failed');
  expect(tracker.job()).toMatchObject({ status: 'failed', error: 'Disk full' });
});
