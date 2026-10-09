import { SKIP_TEXT, type SkipReason } from './removal';

/**
 * Activity (F12): what MediaCare did, from its own records. Removals come
 * from the per-photo outcomes stored at the time (migration 4); copies and
 * creations from the derivatives table. Nothing here is estimated.
 */
export type RemovalRecord = {
  batchId: string;
  assetId: string;
  outcome: string;
  reason: string | null;
  at: number;
};

export type RemovalBatch = {
  batchId: string;
  at: number;
  removed: number;
  skipped: number;
  canceled: number;
  failed: number;
  stillThere: number;
  /** Skip reasons in plain words, with counts, most common first. */
  reasons: { text: string; count: number }[];
};

export function summarizeRemovals(records: readonly RemovalRecord[]): RemovalBatch[] {
  const batches = new Map<string, RemovalBatch & { reasonCounts: Map<string, number> }>();
  for (const record of records) {
    let batch = batches.get(record.batchId);
    if (!batch) {
      batch = {
        batchId: record.batchId,
        at: record.at,
        removed: 0,
        skipped: 0,
        canceled: 0,
        failed: 0,
        stillThere: 0,
        reasons: [],
        reasonCounts: new Map(),
      };
      batches.set(record.batchId, batch);
    }
    batch.at = Math.max(batch.at, record.at);
    switch (record.outcome) {
      case 'removed':
        batch.removed += 1;
        break;
      case 'skipped': {
        batch.skipped += 1;
        const text = (record.reason && SKIP_TEXT[record.reason as SkipReason]) || 'Skipped';
        batch.reasonCounts.set(text, (batch.reasonCounts.get(text) ?? 0) + 1);
        break;
      }
      case 'canceled':
        batch.canceled += 1;
        break;
      case 'still-there':
        batch.stillThere += 1;
        break;
      default:
        batch.failed += 1;
    }
  }
  return [...batches.values()]
    .map(({ reasonCounts, ...batch }) => ({
      ...batch,
      reasons: [...reasonCounts.entries()]
        .map(([text, count]) => ({ text, count }))
        .sort((a, b) => b.count - a.count),
    }))
    .sort((a, b) => b.at - a.at);
}

function plural(count: number, one: string, many: string) {
  return `${count.toLocaleString()} ${count === 1 ? one : many}`;
}

/** One honest headline per batch, e.g. "Moved 12 photos to Recently Deleted". */
export function batchHeadline(batch: RemovalBatch): string {
  if (batch.removed > 0) {
    return `Moved ${plural(batch.removed, 'photo', 'photos')} to Recently Deleted`;
  }
  if (batch.canceled > 0) return 'You canceled in the iOS confirmation';
  if (batch.skipped > 0 && batch.failed === 0) return 'Nothing removed: everything was skipped';
  return 'Nothing was removed';
}

/** Secondary details: what was skipped, canceled or didn't go. */
export function batchDetails(batch: RemovalBatch): string[] {
  const lines: string[] = [];
  if (batch.removed > 0 && batch.canceled > 0) {
    lines.push(`${plural(batch.canceled, 'photo', 'photos')} canceled`);
  }
  for (const reason of batch.reasons)
    lines.push(`${reason.text}: ${reason.count.toLocaleString()} skipped`);
  if (batch.stillThere > 0) {
    lines.push(`${plural(batch.stillThere, 'photo', 'photos')} still in Photos afterwards`);
  }
  if (batch.failed > 0)
    lines.push(`${plural(batch.failed, 'photo', 'photos')} couldn’t be removed`);
  return lines;
}

/** Studio history: a readable name for a recorded recipe. */
export function creationLabel(recipe: string, format: string): string {
  let tool = '';
  try {
    const parsed: unknown = JSON.parse(recipe);
    if (parsed && typeof parsed === 'object' && 'tool' in parsed) {
      tool = String((parsed as { tool: unknown }).tool);
    }
  } catch {
    // Older rows: plain smaller copies.
  }
  switch (tool) {
    case 'adjust':
      return 'Adjusted photo';
    case 'enhance':
      return 'Enhanced photo';
    case 'red-eye':
      return 'Red-eye fixed';
    case 'cutout':
      return 'Background removed';
    case 'passport':
      return 'Passport photo';
    case 'collage':
      return 'Collage';
    case 'slideshow':
      return 'Slideshow';
    case 'video':
      return 'Video copy';
    default:
      return format === 'mp4' ? 'Video' : 'Smaller copy';
  }
}
