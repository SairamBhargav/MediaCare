import { isUserCancel, revalidate, settle, type CurrentState } from './removal';

const here = (version = 1, isFavorite = false): CurrentState => ({
  exists: true,
  version,
  isFavorite,
});
const gone: CurrentState = { exists: false, version: null, isFavorite: false };

function setup(current: Record<string, CurrentState>, reviewed: Record<string, number> = {}) {
  const versions = new Map(Object.keys(current).map((id) => [id, reviewed[id] ?? 1]));
  return { current: new Map(Object.entries(current)), versions };
}

test('unchanged marked photos are removable; keepers never are', () => {
  const { current, versions } = setup({ keep: here(), a: here(), b: here() });
  const result = revalidate(
    { groups: [{ keeperId: 'keep', removeIds: ['a', 'b', 'keep'] }], itemIds: [] },
    current,
    versions,
    new Set(),
  );
  expect(result.removeIds).toEqual(['a', 'b']);
  expect(result.skipped).toEqual([]);
});

test('anything changed, gone, protected or now a favorite is skipped with a reason', () => {
  const { current, versions } = setup(
    { changed: here(2), gone, guarded: here(), fav: here(1, true), ok: here() },
    { changed: 1 },
  );
  const result = revalidate(
    { groups: [], itemIds: ['changed', 'gone', 'guarded', 'fav', 'ok'] },
    current,
    versions,
    new Set(['guarded']),
  );
  expect(result.removeIds).toEqual(['ok']);
  expect(Object.fromEntries(result.skipped.map((entry) => [entry.id, entry.reason]))).toEqual({
    changed: 'changed',
    gone: 'gone',
    guarded: 'protected',
    fav: 'favorite',
  });
});

test('if a group’s keeper is gone or changed, nothing from that group is removed', () => {
  const { current, versions } = setup({ keep: gone, a: here(), b: here() });
  const result = revalidate(
    { groups: [{ keeperId: 'keep', removeIds: ['a', 'b'] }], itemIds: [] },
    current,
    versions,
    new Set(),
  );
  expect(result.removeIds).toEqual([]);
  expect(result.skipped.map((entry) => entry.reason)).toEqual([
    'keeper-unavailable',
    'keeper-unavailable',
  ]);
});

test('a photo that is one group’s keeper is never removed via another group or as an item', () => {
  const { current, versions } = setup({ k1: here(), k2: here(), x: here() });
  const result = revalidate(
    {
      groups: [
        { keeperId: 'k1', removeIds: ['k2', 'x'] },
        { keeperId: 'k2', removeIds: [] },
      ],
      itemIds: ['k1'],
    },
    current,
    versions,
    new Set(),
  );
  expect(result.removeIds).toEqual(['x']);
});

test('each photo is considered once even if planned twice', () => {
  const { current, versions } = setup({ keep: here(), a: here() });
  const result = revalidate(
    { groups: [{ keeperId: 'keep', removeIds: ['a'] }], itemIds: ['a'] },
    current,
    versions,
    new Set(),
  );
  expect(result.removeIds).toEqual(['a']);
});

test('only photos really gone afterwards count as removed', () => {
  expect(settle(['a', 'b', 'c'], new Set(['b']))).toEqual({
    removedIds: ['a', 'c'],
    stillThereIds: ['b'],
  });
});

test('recognizes the iOS cancel', () => {
  expect(
    isUserCancel(
      new Error('The operation couldn’t be completed. (PHPhotosErrorDomain error 3072.)'),
    ),
  ).toBe(true);
  expect(isUserCancel(new Error('Disk full'))).toBe(false);
});
