/**
 * Review selection rules for a cleanup group (duplicates or similar shots).
 *
 * "Selected" here means "marked for possible removal in this review session".
 * It is a reversible choice, never a deletion. Invariants enforced here and
 * tested in review-selection.test.ts:
 *  - The keeper can never be selected; at least one item in a group is kept.
 *  - Protected items can never be selected.
 *  - Choosing a selected item as the new keeper deselects it.
 */
export type ReviewGroup = {
  readonly memberIds: readonly string[];
  readonly keeperId: string;
  readonly protectedIds: ReadonlySet<string>;
};

export type ReviewSelection = {
  readonly keeperId: string;
  readonly selectedIds: ReadonlySet<string>;
};

export function createReviewSelection(group: ReviewGroup): ReviewSelection {
  if (!group.memberIds.includes(group.keeperId)) {
    throw new Error(`Keeper ${group.keeperId} is not a member of the group`);
  }
  return { keeperId: group.keeperId, selectedIds: new Set() };
}

export function canSelect(group: ReviewGroup, selection: ReviewSelection, id: string): boolean {
  return group.memberIds.includes(id) && id !== selection.keeperId && !group.protectedIds.has(id);
}

export function toggleSelected(
  group: ReviewGroup,
  selection: ReviewSelection,
  id: string,
): ReviewSelection {
  if (!canSelect(group, selection, id)) return selection;
  const selectedIds = new Set(selection.selectedIds);
  if (selectedIds.has(id)) selectedIds.delete(id);
  else selectedIds.add(id);
  return { ...selection, selectedIds };
}

export function setKeeper(
  group: ReviewGroup,
  selection: ReviewSelection,
  keeperId: string,
): ReviewSelection {
  if (!group.memberIds.includes(keeperId)) return selection;
  const selectedIds = new Set(selection.selectedIds);
  selectedIds.delete(keeperId);
  return { keeperId, selectedIds };
}

/** Select every member that may be selected (everything except keeper and protected). */
export function selectAllExceptKeeper(
  group: ReviewGroup,
  selection: ReviewSelection,
): ReviewSelection {
  const selectedIds = new Set(group.memberIds.filter((id) => canSelect(group, selection, id)));
  return { ...selection, selectedIds };
}

export function clearSelection(selection: ReviewSelection): ReviewSelection {
  return { ...selection, selectedIds: new Set() };
}

/**
 * "Mark the rest": every member that may be selected, except the photos
 * also suggested to keep in a bigger group. Those can still be marked one
 * by one.
 */
export function selectRest(
  group: ReviewGroup,
  selection: ReviewSelection,
  alsoKeepIds: readonly string[] = [],
): ReviewSelection {
  const keep = new Set(alsoKeepIds);
  const selectedIds = new Set(
    group.memberIds.filter((id) => !keep.has(id) && canSelect(group, selection, id)),
  );
  return { ...selection, selectedIds };
}
