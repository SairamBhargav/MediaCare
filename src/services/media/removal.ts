import { Asset } from 'expo-media-library';

import {
  isUserCancel,
  revalidate,
  settle,
  type CurrentState,
  type PlannedGroup,
  type Revalidation,
} from '@/domain/removal';

/**
 * Removing photos (Phase 3). Verified in the installed SDK 57 source
 * (expo-media-library ios/next): `Asset.delete([...])` makes one
 * `PHAssetChangeRequest.deleteAssets` change, so iOS shows its own
 * confirmation; "Don't Allow" fails the whole request and removes nothing.
 * Photos that no longer exist are dropped silently, so the outcome is
 * verified by looking again afterwards. Removed photos go to Photos →
 * Recently Deleted.
 */
export type RemovalDeps = {
  current: (ids: readonly string[]) => Promise<Map<string, CurrentState>>;
  deleteFromPhotos: (ids: readonly string[]) => Promise<void>;
  record: (entries: { assetId: string; outcome: string; reason: string | null }[]) => Promise<void>;
};

export type RemovalResult =
  | { kind: 'nothing'; check: Revalidation }
  | { kind: 'canceled'; check: Revalidation }
  | { kind: 'failed'; check: Revalidation; message: string }
  | { kind: 'done'; check: Revalidation; removedIds: string[]; stillThereIds: string[] };

export async function removePlanned(
  plan: { groups: readonly PlannedGroup[]; itemIds: readonly string[] },
  reviewedVersions: ReadonlyMap<string, number | null>,
  protectedIds: ReadonlySet<string>,
  deps: RemovalDeps,
): Promise<RemovalResult> {
  const allIds = [
    ...new Set([
      ...plan.groups.flatMap((group) => [group.keeperId, ...group.removeIds]),
      ...plan.itemIds,
    ]),
  ];
  const before = await deps.current(allIds);
  const check = revalidate(plan, before, reviewedVersions, protectedIds);
  const skippedRecords = check.skipped.map((entry) => ({
    assetId: entry.id,
    outcome: 'skipped',
    reason: entry.reason,
  }));

  if (check.removeIds.length === 0) {
    await deps.record(skippedRecords).catch(() => {});
    return { kind: 'nothing', check };
  }

  try {
    await deps.deleteFromPhotos(check.removeIds);
  } catch (error) {
    const canceled = isUserCancel(error);
    await deps
      .record([
        ...skippedRecords,
        ...check.removeIds.map((assetId) => ({
          assetId,
          outcome: canceled ? 'canceled' : 'failed',
          reason: null,
        })),
      ])
      .catch(() => {});
    return canceled
      ? { kind: 'canceled', check }
      : {
          kind: 'failed',
          check,
          message: error instanceof Error ? error.message : 'Photos didn’t remove them.',
        };
  }

  const after = await deps.current(check.removeIds);
  const stillExists = new Set(check.removeIds.filter((id) => after.get(id)?.exists ?? false));
  const { removedIds, stillThereIds } = settle(check.removeIds, stillExists);
  await deps
    .record([
      ...skippedRecords,
      ...removedIds.map((assetId) => ({ assetId, outcome: 'removed', reason: null })),
      ...stillThereIds.map((assetId) => ({ assetId, outcome: 'still-there', reason: null })),
    ])
    .catch(() => {});
  return { kind: 'done', check, removedIds, stillThereIds };
}

async function mapLimited<T, R>(items: readonly T[], limit: number, task: (item: T) => Promise<R>) {
  const results: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const index = next++;
        results[index] = await task(items[index]);
      }
    }),
  );
  return results;
}

/** Fresh state from Photos. A photo that can't be found counts as gone. */
export async function currentFromPhotos(
  ids: readonly string[],
): Promise<Map<string, CurrentState>> {
  const states = await mapLimited(ids, 16, async (id): Promise<CurrentState> => {
    try {
      const asset = new Asset(id);
      const [version, isFavorite] = await Promise.all([
        asset.getModificationTime(),
        asset.getFavorite(),
      ]);
      return { exists: true, version, isFavorite };
    } catch {
      return { exists: false, version: null, isFavorite: false };
    }
  });
  return new Map(ids.map((id, index) => [id, states[index]]));
}

/** Asks iOS to remove these photos; iOS shows its own confirmation. */
export async function deleteFromPhotos(ids: readonly string[]): Promise<void> {
  await Asset.delete(ids.map((id) => new Asset(id)));
}
