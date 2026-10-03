import type { Finding, GroupFinding, ItemFinding } from './findings';
import { formatDuration, type PhotoItem } from './media';

/**
 * Findings for a real library, from catalog metadata only (no file reads,
 * no pixels). Each category says only what the metadata can support:
 *
 *  - moments: photos with identical dimensions taken within `maxGapMs` of
 *    the previous one (bursts and quick repeats). This is about timing, not
 *    visual similarity, and is labelled that way.
 *  - screenshots: Photos marks them with the "screenshot" subtype.
 *  - long-videos: videos of at least `minVideoMs`. Their size is not measured.
 *
 * Favorites are never suggested for removal (enforced through review
 * adjustments), and with no quality analysis yet, the suggested keeper is
 * a favorite if there is one, otherwise the first shot, with that reason
 * stated plainly.
 */
export type RealFindingOptions = {
  maxGapMs?: number;
  minVideoMs?: number;
};

const momentTitle = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

function instant(item: PhotoItem): number | null {
  return item.capturedMs !== null && Number.isFinite(item.capturedMs) ? item.capturedMs : null;
}

export function findMoments(items: readonly PhotoItem[], maxGapMs = 2000): GroupFinding[] {
  const candidates = items
    .filter((item) => item.kind === 'photo' && !item.subtypes.includes('screenshot'))
    .map((item) => ({ item, at: instant(item) }))
    .filter((entry): entry is { item: PhotoItem; at: number } => entry.at !== null)
    .sort((a, b) => a.at - b.at || a.item.id.localeCompare(b.item.id));

  const groups: GroupFinding[] = [];
  let run: { item: PhotoItem; at: number }[] = [];

  const flush = () => {
    if (run.length >= 2) {
      const members = run.map((entry) => entry.item);
      const favorite = members.find((member) => member.isFavorite);
      const keeper = favorite ?? members[0];
      groups.push({
        kind: 'group',
        id: `moments-${members[0].id}`,
        category: 'moments',
        title: momentTitle.format(new Date(run[0].at)),
        memberIds: members.map((member) => member.id),
        keeperId: keeper.id,
        keeperReason: favorite
          ? 'Marked as a favorite in Photos'
          : 'First shot. MediaCare can’t judge sharpness yet, so compare and choose',
      });
    }
    run = [];
  };

  for (const entry of candidates) {
    const previous = run[run.length - 1];
    const continues =
      previous !== undefined &&
      entry.at - previous.at <= maxGapMs &&
      entry.item.width === previous.item.width &&
      entry.item.height === previous.item.height;
    if (!continues) flush();
    run.push(entry);
  }
  flush();
  // Newest moments first, like the rest of the app.
  return groups.reverse();
}

export function findScreenshots(items: readonly PhotoItem[]): ItemFinding[] {
  return items
    .filter((item) => item.subtypes.includes('screenshot'))
    .map((item) => ({
      kind: 'item',
      id: `screenshots-${item.id}`,
      category: 'screenshots',
      assetId: item.id,
      reason: 'Screenshot',
    }));
}

export function findLongVideos(items: readonly PhotoItem[], minVideoMs = 60_000): ItemFinding[] {
  return items
    .filter((item) => item.kind === 'video' && (item.durationMs ?? 0) >= minVideoMs)
    .sort((a, b) => (b.durationMs ?? 0) - (a.durationMs ?? 0))
    .map((item) => ({
      kind: 'item',
      id: `long-videos-${item.id}`,
      category: 'long-videos',
      assetId: item.id,
      reason: `Video, ${formatDuration(item.durationMs ?? 0)}`,
    }));
}

export function findRealFindings(
  items: readonly PhotoItem[],
  { maxGapMs = 2000, minVideoMs = 60_000 }: RealFindingOptions = {},
): Finding[] {
  return [
    ...findMoments(items, maxGapMs),
    ...findScreenshots(items),
    ...findLongVideos(items, minVideoMs),
  ];
}

/** Photos favorites are treated as protected so they are never suggested. */
export function favoriteIds(items: readonly PhotoItem[]): Set<string> {
  return new Set(items.filter((item) => item.isFavorite).map((item) => item.id));
}
