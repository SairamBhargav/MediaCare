export type AnchorRect = { x: number; y: number; width: number; height: number };

type Measure = () => Promise<AnchorRect | null>;

/**
 * Controls the guided tour can point at, by id. Each <TourAnchor> registers
 * how to measure itself in window coordinates; the overlay asks only when a
 * step needs it, so nothing is measured while the tour isn't running.
 */
const anchors = new Map<string, Measure>();

export function registerAnchor(id: string, measure: Measure): () => void {
  anchors.set(id, measure);
  return () => {
    if (anchors.get(id) === measure) anchors.delete(id);
  };
}

/**
 * Where an anchor is on screen, or null if it isn't mounted or isn't
 * visible right now (zero size, or on a page that's off to the side).
 */
export async function measureAnchor(
  id: string,
  screen: { width: number; height: number },
): Promise<AnchorRect | null> {
  const measure = anchors.get(id);
  if (!measure) return null;
  const rect = await measure();
  if (!rect || rect.width <= 0 || rect.height <= 0) return null;
  const onScreen =
    rect.x > -rect.width / 2 &&
    rect.x + rect.width / 2 < screen.width &&
    rect.y + rect.height > 0 &&
    rect.y < screen.height;
  return onScreen ? rect : null;
}
