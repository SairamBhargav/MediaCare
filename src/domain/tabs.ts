/** The main tabs in the order they appear, left to right. */
export const TAB_ORDER = ['index', 'library', 'studio'] as const;
export type TabName = (typeof TAB_ORDER)[number];

/** A swipe switches tabs past this distance (pt) or speed (pt/s). */
export const TAB_SWIPE = { distance: 70, velocity: 600 } as const;

/**
 * Which tab a horizontal swipe leads to: right-to-left goes to the next tab,
 * left-to-right to the previous one. Null at either end or for a short, slow
 * drag.
 */
export function swipeTarget(
  current: string,
  translationX: number,
  velocityX: number,
): TabName | null {
  'worklet';
  const index = TAB_ORDER.indexOf(current as TabName);
  if (index < 0) return null;
  const forward = translationX <= -TAB_SWIPE.distance || velocityX <= -TAB_SWIPE.velocity;
  const back = translationX >= TAB_SWIPE.distance || velocityX >= TAB_SWIPE.velocity;
  if (forward === back) return null;
  return TAB_ORDER[index + (forward ? 1 : -1)] ?? null;
}
