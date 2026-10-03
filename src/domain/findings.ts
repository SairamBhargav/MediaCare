/**
 * Findings and category summaries. Pure: works the same for sample data now
 * and catalog data later.
 *
 * Two shapes:
 *  - Group findings (similar shots, exact copies) have a keeper that is never
 *    counted as reclaimable.
 *  - Item findings (possibly blurry, large files) flag single photos.
 *
 * "Reclaimable" is always "could free up to": logical bytes of candidates,
 * each asset counted once even when several findings include it
 * (docs/PRIVACY_AND_SAFETY.md, honest storage accounting).
 */
export type GroupCategory = 'similar' | 'exact';
export type ItemCategory = 'blurry' | 'large';
export type FindingCategory = GroupCategory | ItemCategory;

export const CATEGORY_ORDER: readonly FindingCategory[] = ['similar', 'exact', 'blurry', 'large'];

export type GroupFinding = {
  readonly kind: 'group';
  readonly id: string;
  readonly category: GroupCategory;
  readonly title: string;
  readonly memberIds: readonly string[];
  readonly keeperId: string;
  readonly keeperReason: string;
};

export type ItemFinding = {
  readonly kind: 'item';
  readonly id: string;
  readonly category: ItemCategory;
  readonly assetId: string;
  readonly reason: string;
};

export type Finding = GroupFinding | ItemFinding;

export type CategorySummary = {
  readonly category: FindingCategory;
  /** Number of groups (group categories) or flagged photos (item categories). */
  readonly findingCount: number;
  /** Distinct photos involved, keepers included. */
  readonly photoCount: number;
  /** Logical bytes of removal candidates in this category, each asset once. */
  readonly reclaimableBytes: number;
  /** Up to three assets to show on the category card, keepers first. */
  readonly previewAssetIds: readonly string[];
};

/**
 * The user's review choices that change what counts as removable:
 * a different keeper for a group, photos they protected, groups they skipped.
 */
export type ReviewAdjustments = {
  readonly keeperOverrides?: Readonly<Record<string, string>>;
  readonly protectedIds?: ReadonlySet<string>;
  readonly skippedIds?: ReadonlySet<string>;
};

const NO_ADJUSTMENTS: ReviewAdjustments = {};

/** The keeper in effect: the user's choice if they made one, else the suggestion. */
export function effectiveKeeperId(
  finding: GroupFinding,
  adjustments: ReviewAdjustments = NO_ADJUSTMENTS,
): string {
  const override = adjustments.keeperOverrides?.[finding.id];
  return override && finding.memberIds.includes(override) ? override : finding.keeperId;
}

/**
 * Asset ids that could be removed if the user agreed. Never a group's keeper,
 * never a protected photo, nothing from a skipped finding.
 */
export function candidateIds(
  finding: Finding,
  adjustments: ReviewAdjustments = NO_ADJUSTMENTS,
): readonly string[] {
  if (adjustments.skippedIds?.has(finding.id)) return [];
  const ids =
    finding.kind === 'group'
      ? finding.memberIds.filter((id) => id !== effectiveKeeperId(finding, adjustments))
      : [finding.assetId];
  const protectedIds = adjustments.protectedIds;
  return protectedIds ? ids.filter((id) => !protectedIds.has(id)) : ids;
}

function involvedIds(finding: Finding): readonly string[] {
  return finding.kind === 'group' ? finding.memberIds : [finding.assetId];
}

function sumOnce(ids: Iterable<string>, bytesOf: (id: string) => number): number {
  let total = 0;
  for (const id of new Set(ids)) total += bytesOf(id);
  return total;
}

export function summarizeCategories(
  findings: readonly Finding[],
  bytesOf: (id: string) => number,
  adjustments: ReviewAdjustments = NO_ADJUSTMENTS,
): CategorySummary[] {
  return CATEGORY_ORDER.flatMap((category) => {
    const inCategory = findings.filter((finding) => finding.category === category);
    if (inCategory.length === 0) return [];
    const involved = new Set(inCategory.flatMap(involvedIds));
    const preview = inCategory
      .map((finding) =>
        finding.kind === 'group' ? effectiveKeeperId(finding, adjustments) : finding.assetId,
      )
      .slice(0, 3);
    return [
      {
        category,
        findingCount: inCategory.length,
        photoCount: involved.size,
        reclaimableBytes: sumOnce(
          inCategory.flatMap((finding) => candidateIds(finding, adjustments)),
          bytesOf,
        ),
        previewAssetIds: preview,
      },
    ];
  });
}

/** Total "could free up to" across all categories, each asset counted once. */
export function totalReclaimableBytes(
  findings: readonly Finding[],
  bytesOf: (id: string) => number,
  adjustments: ReviewAdjustments = NO_ADJUSTMENTS,
): number {
  return sumOnce(
    findings.flatMap((finding) => candidateIds(finding, adjustments)),
    bytesOf,
  );
}

/**
 * Findings fully covered by the photos checked so far. A partial scan only
 * reports a group once every member has been checked, so a stopped scan
 * never shows a half-formed group.
 */
export function findingsWithin(
  findings: readonly Finding[],
  checkedIds: ReadonlySet<string>,
): Finding[] {
  return findings.filter((finding) => involvedIds(finding).every((id) => checkedIds.has(id)));
}
