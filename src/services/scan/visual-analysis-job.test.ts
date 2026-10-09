import { reduceJob, startJob, type Job, type JobEvent } from '@/domain/jobs';
import { toPhotoItem, type PhotoItem, type PhotoRecord } from '@/domain/media';
import { rowFromNative, type NativeAnalysis, type VisualRow } from '@/domain/visual-records';

import { runVisualAnalysis, type VisualJobDeps } from './visual-analysis-job';

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

const ok = (id: string): NativeAnalysis => ({
  id,
  status: 'ok',
  featurePrint: [1, 0],
  sharpness: 10,
  sharpnessMaxTile: 400,
  brightness: 0.5,
  darkFraction: 0,
  brightFraction: 0,
  faces: [],
});

function setup(items: PhotoItem[], stored: VisualRow[] = [], native = ok) {
  const saved: VisualRow[] = [];
  const analyzed: string[][] = [];
  let job: Job = startJob('visual', false, 'analysis');
  const deps: VisualJobDeps = {
    listItems: async () => items,
    loadRows: async () => stored,
    analyze: async (ids) => {
      analyzed.push(ids);
      return ids.map(native);
    },
    saveRows: async (rows) => {
      saved.push(...rows);
    },
    checkpoint: async () => {},
    implementation: IMPL,
    now: () => 5,
  };
  const emit = (event: JobEvent) => {
    job = reduceJob(job, event);
  };
  return { deps, emit, saved, analyzed, job: () => job };
}

test('analyzes photos in batches and saves every result', async () => {
  const items = ['a', 'b', 'c'].map((id) => photo(id));
  const t = setup(items);
  expect(await runVisualAnalysis(t.deps, t.emit, { batchSize: 2 }).done).toBe('succeeded');
  expect(t.analyzed).toEqual([['a', 'b'], ['c']]);
  expect(t.saved.map((row) => row.status)).toEqual(['ok', 'ok', 'ok']);
  expect(t.job()).toMatchObject({ status: 'succeeded', processed: 3, total: 3 });
});

test('screenshots and videos are skipped; current results are reused', async () => {
  const items = [
    photo('done'),
    photo('new'),
    photo('shot', { subtypes: ['screenshot'] }),
    photo('video', { kind: 'video', durationMs: 1 }),
  ];
  const stored = [rowFromNative(ok('done'), items[0], IMPL, 1)];
  const t = setup(items, stored);
  await runVisualAnalysis(t.deps, t.emit).done;
  expect(t.analyzed).toEqual([['new']]);
  expect(t.job()).toMatchObject({ processed: 2, total: 2 });
});

test('a result missing from the native reply is recorded as a failure', async () => {
  const t = setup([photo('a'), photo('b')]);
  t.deps.analyze = async () => [ok('a')];
  await runVisualAnalysis(t.deps, t.emit).done;
  expect(t.saved.map((row) => [row.assetId, row.status])).toEqual([
    ['a', 'ok'],
    ['b', 'failed'],
  ]);
});

test('a native error fails the job honestly and keeps earlier batches', async () => {
  const t = setup([photo('a'), photo('b')]);
  let calls = 0;
  t.deps.analyze = async (ids) => {
    calls += 1;
    if (calls === 2) throw new Error('Vision unavailable');
    return ids.map(ok);
  };
  expect(await runVisualAnalysis(t.deps, t.emit, { batchSize: 1 }).done).toBe('failed');
  expect(t.saved.map((row) => row.assetId)).toEqual(['a']);
  expect(t.job()).toMatchObject({ status: 'failed', error: 'Vision unavailable' });
});

test('pause waits between batches; stop keeps what was saved', async () => {
  const items = ['a', 'b', 'c'].map((id) => photo(id));
  const t = setup(items);
  const controls = runVisualAnalysis(
    {
      ...t.deps,
      saveRows: async (rows) => {
        await t.deps.saveRows(rows);
        controls.cancel();
      },
    },
    t.emit,
    { batchSize: 1 },
  );
  expect(await controls.done).toBe('canceled');
  expect(t.saved).toHaveLength(1);
});

test('measures sizes of videos without a current size, after the photos', async () => {
  const items = [
    photo('p'),
    photo('v1', { kind: 'video', durationMs: 5000 }),
    photo('v2', { kind: 'video', durationMs: 5000 }),
    photo('v3', { kind: 'video', durationMs: 5000, modificationTime: 200 }),
  ];
  const t = setup(items);
  const measured: string[][] = [];
  const savedSizes: { assetId: string; status: string; bytes: number | null }[] = [];
  t.deps.videoSizes = {
    // v2 is already measured at its current version; v3 changed since.
    load: async () => [
      { assetId: 'v2', assetVersion: 100, status: 'ok', bytes: 9, measuredAt: 1 },
      { assetId: 'v3', assetVersion: 100, status: 'ok', bytes: 9, measuredAt: 1 },
    ],
    measure: async (ids) => {
      measured.push(ids);
      return ids.map((id) =>
        id === 'v3' ? { id, status: 'in-icloud' } : { id, status: 'ok', bytes: 1234 },
      );
    },
    save: async (rows) => {
      savedSizes.push(...rows);
    },
  };
  expect(await runVisualAnalysis(t.deps, t.emit).done).toBe('succeeded');
  expect(measured).toEqual([['v1', 'v3']]);
  expect(savedSizes).toEqual([
    { assetId: 'v1', assetVersion: 100, status: 'ok', bytes: 1234, measuredAt: 5 },
    { assetId: 'v3', assetVersion: 200, status: 'in-icloud', bytes: null, measuredAt: 5 },
  ]);
  expect(t.job()).toMatchObject({ status: 'succeeded', processed: 3, total: 3 });
});
