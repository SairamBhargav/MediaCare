import { useMemo } from 'react';
import { create } from 'zustand';

import type { GroupFinding, ReviewAdjustments } from '@/domain/findings';
import {
  createReviewSelection,
  setKeeper,
  type ReviewGroup,
  type ReviewSelection,
} from '@/domain/review-selection';

/**
 * Review choices for the current results, kept for the session so leaving a
 * category and coming back restores them. Every choice here is reversible;
 * none removes anything. Cleared whenever the results change (new scan,
 * reset). Protection is session-only in Phase 1 and moves to the catalog
 * in Phase 2 (P2-DB-004).
 */
type ReviewSession = {
  /** Per group: keeper in effect and selected members. Created on first change. */
  selections: Readonly<Record<string, ReviewSelection>>;
  skippedIds: ReadonlySet<string>;
  protectedIds: ReadonlySet<string>;
  /** Selected photos in item categories (possibly blurry, large files). */
  itemSelectedIds: ReadonlySet<string>;
  setGroupSelection: (groupId: string, selection: ReviewSelection) => void;
  setGroupKeeper: (group: GroupFinding, assetId: string) => void;
  toggleItem: (assetId: string) => void;
  toggleProtected: (assetId: string) => void;
  skip: (groupId: string) => void;
  unskip: (groupId: string) => void;
  reset: () => void;
};

const empty = {
  selections: {},
  skippedIds: new Set<string>(),
  protectedIds: new Set<string>(),
  itemSelectedIds: new Set<string>(),
};

function withoutId(set: ReadonlySet<string>, id: string): ReadonlySet<string> {
  if (!set.has(id)) return set;
  const next = new Set(set);
  next.delete(id);
  return next;
}

function toggled(set: ReadonlySet<string>, id: string): ReadonlySet<string> {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

export const useReviewSession = create<ReviewSession>()((set, get) => ({
  ...empty,
  setGroupSelection: (groupId, selection) =>
    set((state) => ({ selections: { ...state.selections, [groupId]: selection } })),
  setGroupKeeper: (group, assetId) => {
    const current =
      get().selections[group.id] ?? createReviewSelection(toReviewGroup(group, get()));
    get().setGroupSelection(group.id, setKeeper(toReviewGroup(group, get()), current, assetId));
  },
  toggleItem: (assetId) => {
    if (get().protectedIds.has(assetId)) return;
    set((state) => ({ itemSelectedIds: toggled(state.itemSelectedIds, assetId) }));
  },
  toggleProtected: (assetId) =>
    set((state) => {
      const protecting = !state.protectedIds.has(assetId);
      if (!protecting) return { protectedIds: withoutId(state.protectedIds, assetId) };
      // A protected photo can't stay selected anywhere.
      const selections = Object.fromEntries(
        Object.entries(state.selections).map(([id, selection]) => [
          id,
          { ...selection, selectedIds: withoutId(selection.selectedIds, assetId) },
        ]),
      );
      return {
        protectedIds: new Set([...state.protectedIds, assetId]),
        selections,
        itemSelectedIds: withoutId(state.itemSelectedIds, assetId),
      };
    }),
  skip: (groupId) =>
    set((state) => {
      const { [groupId]: _dropped, ...selections } = state.selections;
      const kept = state.selections[groupId];
      return {
        skippedIds: new Set([...state.skippedIds, groupId]),
        // Skipping clears the selection but keeps a chosen keeper.
        selections: kept
          ? { ...selections, [groupId]: { ...kept, selectedIds: new Set() } }
          : selections,
      };
    }),
  unskip: (groupId) => set((state) => ({ skippedIds: withoutId(state.skippedIds, groupId) })),
  reset: () => set({ ...empty }),
}));

/** The review rules for a group, including photos the user protected. */
export function toReviewGroup(
  group: GroupFinding,
  state: Pick<ReviewSession, 'protectedIds'>,
): ReviewGroup {
  return { memberIds: group.memberIds, keeperId: group.keeperId, protectedIds: state.protectedIds };
}

/** The current selection for a group, or a fresh one with the suggested keeper. */
export function selectionFor(
  group: GroupFinding,
  state: Pick<ReviewSession, 'selections' | 'protectedIds'>,
): ReviewSelection {
  return state.selections[group.id] ?? createReviewSelection(toReviewGroup(group, state));
}

/** Review choices in the shape the findings totals understand. */
export function useReviewAdjustments(): ReviewAdjustments {
  const selections = useReviewSession((state) => state.selections);
  const protectedIds = useReviewSession((state) => state.protectedIds);
  const skippedIds = useReviewSession((state) => state.skippedIds);
  return useMemo(
    () => ({
      keeperOverrides: Object.fromEntries(
        Object.entries(selections).map(([id, selection]) => [id, selection.keeperId]),
      ),
      protectedIds,
      skippedIds,
    }),
    [selections, protectedIds, skippedIds],
  );
}
