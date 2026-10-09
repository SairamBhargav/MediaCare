import { TAB_ORDER, type TabName } from '@/domain/tabs';

/**
 * Which way the last tab switch went, so the tab that appears can slide in
 * from that side. A plain module value, not React state: it is read once
 * when the new tab gains focus, and must never cause a re-render.
 */
let direction: -1 | 0 | 1 = 0;

export function noteTabMove(from: string, to: string) {
  const a = TAB_ORDER.indexOf(from as TabName);
  const b = TAB_ORDER.indexOf(to as TabName);
  direction = a < 0 || b < 0 || a === b ? 0 : b > a ? 1 : -1;
}

/** Returns the pending direction once (1 = came from the left tab), then clears it. */
export function takeTabMove(): -1 | 0 | 1 {
  const value = direction;
  direction = 0;
  return value;
}
