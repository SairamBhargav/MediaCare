import { deleteAssets, insertRemovals } from '@/db/catalog-repo';
import type { ActionPlan } from '@/domain/action-plan';
import {
  currentFromPhotos,
  deleteFromPhotos,
  removePlanned,
  type RemovalResult,
} from '@/services/media/removal';
import { useCatalog } from '@/state/catalog';
import { useCleanSession } from '@/state/clean-session';

/**
 * Carries out a reviewed removal plan: checks every photo again, asks iOS
 * (which shows its own confirmation), verifies what is really gone, records
 * each outcome, and refreshes results. Removed photos go to Recently Deleted.
 */
export async function runRemoval(
  plan: ActionPlan,
  protectedIds: ReadonlySet<string>,
): Promise<RemovalResult> {
  const { byId } = useCatalog.getState();
  const batchId = `removal-${Date.now()}`;
  const ids = [
    ...plan.groups.flatMap((group) => [group.keeperId, ...group.removeIds]),
    ...plan.items.map((item) => item.finding.assetId),
  ];
  const reviewedVersions = new Map(ids.map((id) => [id, byId.get(id)?.version ?? null]));

  const result = await removePlanned(
    {
      groups: plan.groups.map((group) => ({
        keeperId: group.keeperId,
        removeIds: group.removeIds,
      })),
      itemIds: plan.items.map((item) => item.finding.assetId),
    },
    reviewedVersions,
    protectedIds,
    {
      current: currentFromPhotos,
      deleteFromPhotos,
      record: (entries) => insertRemovals(batchId, entries),
    },
  );

  if (result.kind === 'done' && result.removedIds.length > 0) {
    await deleteAssets(result.removedIds).catch(() => {});
    await useCatalog
      .getState()
      .load()
      .catch(() => {});
    useCleanSession.getState().showCatalogResults();
  }
  return result;
}
