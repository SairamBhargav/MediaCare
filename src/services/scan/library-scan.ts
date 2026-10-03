import type { AssetMetadata } from 'expo-media-library';

import type { JobEvent } from '@/domain/jobs';
import type { PhotoRecord } from '@/domain/media';

/**
 * Foreground scan of the accessible Photos library into the catalog.
 *
 *  1. Listing: page through metadata (no file reads, no iCloud downloads).
 *  2. Checking: in batches, read cheap per-asset subtypes for new or
 *     changed assets only, write the batch, checkpoint, yield to the UI.
 *  3. Grouping: after a *complete* pass, drop catalog rows the scan didn't
 *     see (deleted in Photos, or no longer shared under limited access).
 *
 * Stop keeps everything written so far and never drops rows. Progress comes
 * only from completed batches. Dependencies are injected so the
 * orchestration is testable without a device.
 */
export type LibraryScanDeps = {
  listAllMetadata: (
    onPage: (fetched: number) => void,
    shouldStop: () => boolean,
  ) => Promise<AssetMetadata[]>;
  getSubtypes: (id: string) => Promise<string[]>;
  toRecord: (metadata: AssetMetadata, subtypes: readonly string[]) => PhotoRecord;
  loadVersions: () => Promise<Map<string, number | null>>;
  upsertAssets: (records: readonly PhotoRecord[], scanId: string) => Promise<void>;
  markSeen: (ids: readonly string[], scanId: string) => Promise<void>;
  removeUnseen: (scanId: string) => Promise<number>;
  checkpoint: (state: {
    status: 'running' | 'paused' | 'succeeded' | 'canceled' | 'failed';
    processed: number;
    total: number | null;
    error?: string;
  }) => Promise<void>;
};

export type LibraryScanControls = {
  pause: () => void;
  resume: () => void;
  cancel: () => void;
  /** Settles when the scan ends, however it ends. */
  done: Promise<'succeeded' | 'canceled' | 'failed'>;
};

export type LibraryScanOptions = { batchSize?: number; concurrency?: number };

const yieldToUi = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

async function mapLimited<T, R>(items: readonly T[], limit: number, task: (item: T) => Promise<R>) {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await task(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

export function runLibraryScan(
  scanId: string,
  deps: LibraryScanDeps,
  emit: (event: JobEvent) => void,
  { batchSize = 100, concurrency = 24 }: LibraryScanOptions = {},
): LibraryScanControls {
  let canceled = false;
  let paused = false;
  let wake: (() => void) | null = null;
  let processed = 0;
  let total: number | null = null;

  const waitWhilePaused = async () => {
    while (paused && !canceled) {
      await new Promise<void>((resolve) => {
        wake = resolve;
      });
    }
  };

  const run = async (): Promise<'succeeded' | 'canceled' | 'failed'> => {
    try {
      emit({ type: 'progress', stage: 'listing', processed: 0 });
      const metadata = await deps.listAllMetadata(
        () => {},
        () => canceled,
      );
      if (canceled) return 'canceled';

      total = metadata.length;
      emit({ type: 'total-known', total });
      await deps.checkpoint({ status: 'running', processed, total });
      const versions = await deps.loadVersions();

      for (let start = 0; start < metadata.length; start += batchSize) {
        await waitWhilePaused();
        if (canceled) return 'canceled';

        const batch = metadata.slice(start, start + batchSize);
        const changed = batch.filter(
          (item) => !versions.has(item.id) || versions.get(item.id) !== item.modificationTime,
        );
        const unchanged = batch.filter((item) => !changed.includes(item));

        const subtypes = await mapLimited(changed, concurrency, (item) =>
          deps.getSubtypes(item.id),
        );
        await deps.upsertAssets(
          changed.map((item, index) => deps.toRecord(item, subtypes[index])),
          scanId,
        );
        await deps.markSeen(
          unchanged.map((item) => item.id),
          scanId,
        );

        processed += batch.length;
        emit({ type: 'progress', stage: 'checking', processed });
        await deps.checkpoint({ status: 'running', processed, total });
        await yieldToUi();
      }

      if (canceled) return 'canceled';
      emit({ type: 'progress', stage: 'grouping', processed });
      await deps.removeUnseen(scanId);
      await deps.checkpoint({ status: 'succeeded', processed, total });
      emit({ type: 'succeed' });
      return 'succeeded';
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The scan stopped unexpectedly';
      emit({ type: 'fail', message });
      await deps.checkpoint({ status: 'failed', processed, total, error: message }).catch(() => {});
      return 'failed';
    }
  };

  const done = run().then(async (outcome) => {
    if (outcome === 'canceled') {
      await deps.checkpoint({ status: 'canceled', processed, total }).catch(() => {});
    }
    return outcome;
  });

  return {
    done,
    pause() {
      if (canceled || paused) return;
      paused = true;
      emit({ type: 'pause' });
      deps.checkpoint({ status: 'paused', processed, total }).catch(() => {});
    },
    resume() {
      if (canceled || !paused) return;
      paused = false;
      emit({ type: 'resume' });
      wake?.();
    },
    cancel() {
      if (canceled) return;
      canceled = true;
      emit({ type: 'cancel' });
      wake?.();
    },
  };
}
