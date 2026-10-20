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

describe('opt-in iCloud pass (ADR-0009)', () => {
  const local = (id: string): NativeAnalysis =>
    id.startsWith('cloud') ? { id, status: 'in-icloud' } : ok(id);

  test('without it, iCloud photos stay in iCloud and nothing is retried', async () => {
    const t = setup([photo('a'), photo('cloud1')], [], local);
    await runVisualAnalysis(t.deps, t.emit).done;
    expect(t.saved.map((row) => row.status)).toEqual(['ok', 'in-icloud']);
    expect(t.job().step).toBeUndefined();
  });

  test('iCloud photos are retried last with downloads, after local ones', async () => {
    const t = setup([photo('cloud1'), photo('a'), photo('cloud2')], [], local);
    const fetched: string[][] = [];
    t.deps.cloud = {
      blocked: async () => null,
      run: async (ids) => {
        fetched.push(ids);
        return ids.map(ok);
      },
      onBlocked: jest.fn(),
    };
    expect(await runVisualAnalysis(t.deps, t.emit, { batchSize: 8, cloudBatchSize: 1 }).done).toBe(
      'succeeded',
    );
    expect(fetched).toEqual([['cloud1'], ['cloud2']]);
    const last = new Map(t.saved.map((row) => [row.assetId, row.status]));
    expect([...last.values()]).toEqual(['ok', 'ok', 'ok']);
    expect(t.job()).toMatchObject({ processed: 3, total: 3, step: { done: 2, total: 2 } });
  });

  test('a blocked connection stops the pass and says why; the rest stay in iCloud', async () => {
    const t = setup([photo('cloud1'), photo('cloud2')], [], local);
    const reasons = ['ok', 'mobile-data'] as const;
    let call = 0;
    const onBlocked = jest.fn();
    t.deps.cloud = {
      blocked: async () => (reasons[call++] === 'ok' ? null : 'mobile-data'),
      run: async (ids) => ids.map(ok),
      onBlocked,
    };
    expect(await runVisualAnalysis(t.deps, t.emit, { cloudBatchSize: 1 }).done).toBe('succeeded');
    expect(onBlocked).toHaveBeenCalledWith('mobile-data');
    const last = new Map(t.saved.map((row) => [row.assetId, row.status]));
    expect(last.get('cloud1')).toBe('ok');
    expect(last.get('cloud2')).toBe('in-icloud');
  });

  test('Stop during the pass keeps what was downloaded', async () => {
    const t = setup([photo('cloud1'), photo('cloud2')], [], local);
    let controls: ReturnType<typeof runVisualAnalysis> | null = null;
    t.deps.cloud = {
      blocked: async () => null,
      run: async (ids) => {
        controls?.cancel();
        return ids.map(ok);
      },
      onBlocked: jest.fn(),
    };
    controls = runVisualAnalysis(t.deps, t.emit, { cloudBatchSize: 1 });
    expect(await controls.done).toBe('canceled');
    const last = new Map(t.saved.map((row) => [row.assetId, row.status]));
    expect(last.get('cloud1')).toBe('ok');
    expect(last.get('cloud2')).toBe('in-icloud');
  });
});

describe('People step (ADR-0011)', () => {
  const withFace = (id: string): NativeAnalysis => ({
    ...ok(id),
    faces: id.startsWith('face')
      ? [{ quality: 0.8, leftEyeOpen: 1, rightEyeOpen: 1, width: 0.2, height: 0.2 }]
      : [],
  });

  function withRows(items: PhotoItem[], native = withFace) {
    const t = setup(items, [], native);
    // The step reads rows back after analysis; serve what was saved.
    t.deps.loadRows = async () => t.saved;
    return t;
  }

  test('only photos with faces and no current face scan are looked at, then grouped once', async () => {
    const t = withRows([photo('face1'), photo('plain'), photo('face2'), photo('face3')]);
    const asked: string[][] = [];
    const group = jest.fn(async () => {});
    t.deps.people = {
      scanned: async () => new Set(['face3']),
      find: async (ids) => {
        asked.push(ids);
        return ids.map((id) => ({ id, status: 'ok' }));
      },
      save: async () => {},
      group,
    };
    expect(await runVisualAnalysis(t.deps, t.emit, { peopleBatchSize: 1 }).done).toBe('succeeded');
    expect(asked).toEqual([['face1'], ['face2']]);
    expect(group).toHaveBeenCalledTimes(1);
  });

  test('nothing new: no grouping', async () => {
    const t = withRows([photo('plain')]);
    const group = jest.fn(async () => {});
    t.deps.people = {
      scanned: async () => new Set(),
      find: jest.fn(),
      save: async () => {},
      group,
    };
    await runVisualAnalysis(t.deps, t.emit).done;
    expect(t.deps.people.find).not.toHaveBeenCalled();
    expect(group).not.toHaveBeenCalled();
  });

  test('downloads for faces only while the iCloud pass allows it', async () => {
    const t = withRows([photo('face1'), photo('face2')]);
    const network: boolean[] = [];
    let checks = 0;
    t.deps.cloud = {
      // Allowed for the first face batch, then the phone leaves Wi-Fi.
      blocked: async () => (checks++ === 0 ? null : 'mobile-data'),
      run: async (ids) => ids.map(withFace),
      onBlocked: jest.fn(),
    };
    t.deps.people = {
      scanned: async () => new Set(),
      find: async (ids, allowNetwork) => {
        network.push(allowNetwork);
        return ids.map((id) => ({ id, status: 'ok' }));
      },
      save: async () => {},
      group: async () => {},
    };
    await runVisualAnalysis(t.deps, t.emit, { peopleBatchSize: 1 }).done;
    expect(network).toEqual([true, false]);
  });
});
