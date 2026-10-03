import {
  effectiveKeeperId,
  type Finding,
  type GroupFinding,
  type ItemFinding,
  type ReviewAdjustments,
} from './findings';

/**
 * The removal plan: exactly what would be removed and what is kept, built
 * from the user's review choices. Pure and safety-critical; invariants are
 * enforced here and tested in action-plan.test.ts:
 *
 *  1. A keeper is never in the plan, even if it is also flagged elsewhere
 *     (e.g. a group's keeper that is also "possibly blurry").
 *  2. Protected photos are never in the plan.
 *  3. Nothing from a skipped group is in the plan.
 *  4. Every group in the plan keeps at least one photo.
 *  5. Each photo appears once and its bytes are counted once.
 */
export type ReviewChoices = ReviewAdjustments & {
  /** Selected members per group id. */
  readonly groupSelections: Readonly<Record<string, ReadonlySet<string>>>;
  /** Selected photos in item categories. */
  readonly itemSelectedIds: ReadonlySet<string>;
};

export type PlannedGroup = {
  readonly finding: GroupFinding;
  readonly keeperId: string;
  readonly removeIds: readonly string[];
};

export type PlannedItem = {
  readonly finding: ItemFinding;
};

export type ActionPlan = {
  readonly groups: readonly PlannedGroup[];
  readonly items: readonly PlannedItem[];
  /** Every photo to remove, once. */
  readonly assetIds: readonly string[];
  /** Logical bytes of `assetIds`. "Could free up to", never a measured result. */
  readonly bytes: number;
  /** Selected photos left out because they are a keeper of some group. */
  readonly excludedKeeperIds: readonly string[];
};

export function buildActionPlan(
  findings: readonly Finding[],
  choices: ReviewChoices,
  bytesOf: (id: string) => number,
): ActionPlan {
  const protectedIds = choices.protectedIds ?? new Set<string>();
  const skippedIds = choices.skippedIds ?? new Set<string>();
  const groupFindings = findings.filter((f): f is GroupFinding => f.kind === 'group');

  // Rule 1: any group's keeper is off-limits everywhere, skipped or not.
  const keeperIds = new Set(groupFindings.map((group) => effectiveKeeperId(group, choices)));
  const excludedKeeperIds = new Set<string>();
  const planned = new Set<string>();

  const allowed = (id: string) => {
    if (protectedIds.has(id)) return false;
    if (keeperIds.has(id)) {
      excludedKeeperIds.add(id);
      return false;
    }
    return true;
  };

  const groups: PlannedGroup[] = [];
  for (const finding of groupFindings) {
    if (skippedIds.has(finding.id)) continue;
    const selected = choices.groupSelections[finding.id];
    if (!selected) continue;
    const keeperId = effectiveKeeperId(finding, choices);
    const removeIds = finding.memberIds.filter(
      (id) => selected.has(id) && id !== keeperId && allowed(id),
    );
    // Rule 4 holds because the keeper is a member and is never removed.
    if (removeIds.length === 0) continue;
    removeIds.forEach((id) => planned.add(id));
    groups.push({ finding, keeperId, removeIds });
  }

  const items: PlannedItem[] = [];
  for (const finding of findings) {
    if (finding.kind !== 'item' || skippedIds.has(finding.id)) continue;
    if (!choices.itemSelectedIds.has(finding.assetId) || !allowed(finding.assetId)) continue;
    // Rule 5: a photo already planned through a group isn't listed twice.
    if (planned.has(finding.assetId)) continue;
    planned.add(finding.assetId);
    items.push({ finding });
  }

  const assetIds = [...planned];
  return {
    groups,
    items,
    assetIds,
    bytes: assetIds.reduce((total, id) => total + bytesOf(id), 0),
    excludedKeeperIds: [...excludedKeeperIds],
  };
}
