import type { CurrentState } from '@/domain/removal';

import { removePlanned, type RemovalDeps } from './removal';

const here: CurrentState = { exists: true, version: 1, isFavorite: false };

function fakePhotos(initial: Record<string, CurrentState>) {
  const photos = new Map(Object.entries(initial));
  const recorded: { assetId: string; outcome: string; reason: string | null }[] = [];
  const deleted: string[][] = [];
  const deps: RemovalDeps = {
    current: async (ids) =>
      new Map(
        ids.map((id) => [
          id,
          photos.get(id) ?? { exists: false, version: null, isFavorite: false },
        ]),
      ),
    deleteFromPhotos: async (ids) => {
      deleted.push([...ids]);
      ids.forEach((id) => photos.delete(id));
    },
    record: async (entries) => {
      recorded.push(...entries);
    },
  };
  return { deps, photos, recorded, deleted };
}

const versions = (ids: string[]) => new Map(ids.map((id) => [id, 1]));

test('removes only what still checks out, keeps the keeper, and records every outcome', async () => {
  const fake = fakePhotos({ keep: here, a: here, b: { ...here, version: 2 } });
  const result = await removePlanned(
    { groups: [{ keeperId: 'keep', removeIds: ['a', 'b'] }], itemIds: [] },
    versions(['keep', 'a', 'b']),
    new Set(),
    fake.deps,
  );
  expect(fake.deleted).toEqual([['a']]);
  expect(result).toMatchObject({ kind: 'done', removedIds: ['a'], stillThereIds: [] });
  expect(fake.photos.has('keep')).toBe(true);
  expect(fake.recorded).toEqual([
    { assetId: 'b', outcome: 'skipped', reason: 'changed' },
    { assetId: 'a', outcome: 'removed', reason: null },
  ]);
});

test('“Don’t Allow” on the iOS confirmation removes nothing and says so', async () => {
  const fake = fakePhotos({ keep: here, a: here });
  fake.deps.deleteFromPhotos = async () => {
    throw new Error('The operation couldn’t be completed. (PHPhotosErrorDomain error 3072.)');
  };
  const result = await removePlanned(
    { groups: [{ keeperId: 'keep', removeIds: ['a'] }], itemIds: [] },
    versions(['keep', 'a']),
    new Set(),
    fake.deps,
  );
  expect(result.kind).toBe('canceled');
  expect(fake.photos.has('a')).toBe(true);
  expect(fake.recorded).toEqual([{ assetId: 'a', outcome: 'canceled', reason: null }]);
});

test('if Photos still has a photo afterwards, it is not reported as removed', async () => {
  const fake = fakePhotos({ a: here, b: here });
  fake.deps.deleteFromPhotos = async (ids) => {
    fake.photos.delete(ids[0]); // only the first actually went
  };
  const result = await removePlanned(
    { groups: [], itemIds: ['a', 'b'] },
    versions(['a', 'b']),
    new Set(),
    fake.deps,
  );
  expect(result).toMatchObject({ kind: 'done', removedIds: ['a'], stillThereIds: ['b'] });
});

test('nothing left after the checks: iOS is never asked', async () => {
  const fake = fakePhotos({ a: { ...here, isFavorite: true } });
  const result = await removePlanned(
    { groups: [], itemIds: ['a'] },
    versions(['a']),
    new Set(),
    fake.deps,
  );
  expect(result.kind).toBe('nothing');
  expect(fake.deleted).toEqual([]);
});
