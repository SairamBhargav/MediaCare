/**
 * Safe removal (Phase 3). Pure rules; the service that talks to Photos is
 * services/media/removal.ts. docs/PRIVACY_AND_SAFETY.md, "Removal":
 *
 *  - Nothing is removed automatically. The user builds a plan, reviews it,
 *    taps Remove, and iOS asks for its own confirmation.
 *  - Right before asking iOS, every photo is checked again. Anything that
 *    changed since it was reviewed is skipped and reported, never removed.
 *  - Every group keeps its keeper. If a keeper is gone or changed, nothing
 *    from that group is removed.
 *  - Protected photos and favorites are never removed, even if marked.
 *  - After iOS answers, Photos is checked again: only photos that are
 *    really gone count as removed.
 */

/** What Photos says about a photo right now. `exists: false` if it's gone. */
export type CurrentState = { exists: boolean; version: number | null; isFavorite: boolean };

export type PlannedGroup = { keeperId: string; removeIds: readonly string[] };

export type SkipReason = 'gone' | 'changed' | 'favorite' | 'protected' | 'keeper-unavailable';

export const SKIP_TEXT: Record<SkipReason, string> = {
  gone: 'Already gone from Photos',
  changed: 'Changed since you reviewed it',
  favorite: 'Marked as a favorite',
  protected: 'Protected in MediaCare',
  'keeper-unavailable': 'The photo kept from its group is gone or changed',
};

export type Revalidation = {
  removeIds: string[];
  skipped: { id: string; reason: SkipReason }[];
};

/**
 * Decides, from a fresh look at Photos, which planned photos may still be
 * removed. `reviewedVersions` are the versions the user saw when reviewing.
 */
export function revalidate(
  plan: { groups: readonly PlannedGroup[]; itemIds: readonly string[] },
  current: ReadonlyMap<string, CurrentState>,
  reviewedVersions: ReadonlyMap<string, number | null>,
  protectedIds: ReadonlySet<string>,
): Revalidation {
  const removeIds: string[] = [];
  const skipped: Revalidation['skipped'] = [];
  const seen = new Set<string>();

  const unchanged = (id: string) => {
    const state = current.get(id);
    return !!state && state.exists && state.version === (reviewedVersions.get(id) ?? null);
  };

  const consider = (id: string) => {
    if (seen.has(id)) return;
    seen.add(id);
    const state = current.get(id);
    if (!state || !state.exists) skipped.push({ id, reason: 'gone' });
    else if (protectedIds.has(id)) skipped.push({ id, reason: 'protected' });
    else if (state.isFavorite) skipped.push({ id, reason: 'favorite' });
    else if (!unchanged(id)) skipped.push({ id, reason: 'changed' });
    else removeIds.push(id);
  };

  // Keepers are never removable, even if marked elsewhere.
  const keepers = new Set(plan.groups.map((group) => group.keeperId));

  for (const group of plan.groups) {
    if (!unchanged(group.keeperId)) {
      for (const id of group.removeIds) {
        if (seen.has(id) || keepers.has(id)) continue;
        seen.add(id);
        skipped.push({ id, reason: 'keeper-unavailable' });
      }
      continue;
    }
    for (const id of group.removeIds) {
      if (!keepers.has(id)) consider(id);
    }
  }
  for (const id of plan.itemIds) {
    if (!keepers.has(id)) consider(id);
  }
  return { removeIds, skipped };
}

export type RemovalOutcome =
  | { kind: 'removed'; removedIds: string[]; stillThereIds: string[] }
  | { kind: 'canceled' }
  | { kind: 'failed'; message: string };

/** After iOS answers: only photos that are really gone count as removed. */
export function settle(
  requestedIds: readonly string[],
  stillExists: ReadonlySet<string>,
): { removedIds: string[]; stillThereIds: string[] } {
  return {
    removedIds: requestedIds.filter((id) => !stillExists.has(id)),
    stillThereIds: requestedIds.filter((id) => stillExists.has(id)),
  };
}

/** Recognizes the user tapping "Don't Allow" on the iOS confirmation. */
export function isUserCancel(error: unknown): boolean {
  const text =
    error instanceof Error
      ? `${error.message} ${String((error as { code?: unknown }).code ?? '')}`
      : String(error);
  // PHPhotosErrorUserCancelled is 3072 in the PHPhotosErrorDomain.
  return /3072|cancel/i.test(text);
}
