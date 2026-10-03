import { useMemo } from 'react';

import { knownBytes } from '@/features/media/registry';
import { buildActionPlan, type ActionPlan } from '@/domain/action-plan';
import { useCleanSession } from '@/state/clean-session';
import { useReviewAdjustments, useReviewSession } from '@/state/review-session';

/** The removal plan for the current results and review choices. */
export function useActionPlan(): ActionPlan {
  const state = useCleanSession((session) => session.state);
  const selections = useReviewSession((review) => review.selections);
  const itemSelectedIds = useReviewSession((review) => review.itemSelectedIds);
  const adjustments = useReviewAdjustments();

  return useMemo(() => {
    const findings = state.status === 'results' ? state.findings : [];
    const groupSelections = Object.fromEntries(
      Object.entries(selections).map(([id, selection]) => [id, selection.selectedIds]),
    );
    return buildActionPlan(
      findings,
      { ...adjustments, groupSelections, itemSelectedIds },
      knownBytes,
    );
  }, [state, selections, itemSelectedIds, adjustments]);
}
