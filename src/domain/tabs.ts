/**
 * Paging between the main tabs (Clean, Library, Studio), like swiping
 * between pages in Instagram: the strip follows the finger 1:1, and on
 * release it settles on a page chosen from where it is and how fast it was
 * moving. Pure and worklet-safe, so it runs on the UI thread.
 */

/** The main tabs in the order they appear, left to right. */
export const TAB_ORDER = ['index', 'library', 'studio'] as const;
export type TabName = (typeof TAB_ORDER)[number];

/** Share of the flick velocity (pt/s) added to the position to decide the page. */
const MOMENTUM_SECONDS = 0.18;
/** Past the first or last page the strip moves this fraction of the finger. */
export const EDGE_RESISTANCE = 0.25;

/** Strip offset (negative translateX) for a page. */
export function pageOffset(index: number, width: number): number {
  'worklet';
  return -index * width;
}

/** Where the strip sits while dragging: 1:1 inside, resisted past either end. */
export function dragOffset(start: number, translationX: number, width: number, count: number) {
  'worklet';
  const next = start + translationX;
  const max = 0;
  const min = -(count - 1) * width;
  if (next > max) return max + (next - max) * EDGE_RESISTANCE;
  if (next < min) return min + (next - min) * EDGE_RESISTANCE;
  return next;
}

/**
 * The page to settle on: the nearest one to where the strip would coast,
 * never more than one page away from where the drag started.
 */
export function settlePage(
  offset: number,
  velocityX: number,
  width: number,
  current: number,
  count: number,
): number {
  'worklet';
  if (width <= 0 || count <= 0) return current;
  const projected = -(offset + velocityX * MOMENTUM_SECONDS) / width;
  const nearest = Math.round(projected);
  const oneStep = Math.min(current + 1, Math.max(current - 1, nearest));
  return Math.min(count - 1, Math.max(0, oneStep));
}
