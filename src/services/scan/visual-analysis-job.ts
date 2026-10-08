import type { JobEvent } from '@/domain/jobs';
import type { PhotoItem } from '@/domain/media';
import {
  isAnalyzable,
  isReusableVisual,
  rowFromNative,
  type NativeAnalysis,
  type VisualRow,
} from '@/domain/visual-records';

/**
 * "Look at my photos" (Phase 3): a user-started job that runs on-device
 * visual analysis (Apple Vision) over cataloged photos, in small batches.
 *
 *  1. Listing: photos (not screenshots or videos) from the catalog.
 *  2. Checking: photos without current results are analyzed natively,
 *     a batch at a time; results are saved after each batch.
 *  3. Grouping: nothing to compute here; findings are derived from the
 *     stored scores when results are shown.
 *
 * Photos stored only in iCloud are reported, never downloaded. Pause waits
 * between batches; Stop keeps everything saved so far.
 */
export type VisualJobDeps = {
  listItems: () => Promise<readonly PhotoItem[]>;
  loadRows: () => Promise<readonly VisualRow[]>;
  analyze: (ids: string[]) => Promise<NativeAnalysis[]>;
  saveRows: (rows: readonly VisualRow[]) => Promise<void>;
  checkpoint: (state: {
    status: 'running' | 'paused' | 'succeeded' | 'canceled' | 'failed';
    processed: number;
    total: number | null;
    error?: string;
  }) => Promise<void>;
  implementation: string;
  now?: () => number;
};

export type VisualJobControls = {
  pause: () => void;
  resume: () => void;
  cancel: () => void;
  done: Promise<'succeeded' | 'canceled' | 'failed'>;
};

const yieldToUi = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

export function runVisualAnalysis(
  deps: VisualJobDeps,
  emit: (event: JobEvent) => void,
  { batchSize = 8 }: { batchSize?: number } = {},
): VisualJobControls {
  const now = deps.now ?? Date.now;
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
      const items = (await deps.listItems()).filter(isAnalyzable);
      const stored = new Map((await deps.loadRows()).map((row) => [row.assetId, row]));
      if (canceled) return 'canceled';

      total = items.length;
      emit({ type: 'total-known', total });
      await deps.checkpoint({ status: 'running', processed, total });

      const todo: PhotoItem[] = [];
      for (const item of items) {
        const row = stored.get(item.id);
        if (row && isReusableVisual(row, item, deps.implementation)) processed += 1;
        else todo.push(item);
      }
      emit({ type: 'progress', stage: 'checking', processed });

      for (let start = 0; start < todo.length; start += batchSize) {
        await waitWhilePaused();
        if (canceled) return 'canceled';
        const batch = todo.slice(start, start + batchSize);
        const results = await deps.analyze(batch.map((item) => item.id));
        const byId = new Map(results.map((result) => [result.id, result]));
        const rows = batch.map((item) =>
          rowFromNative(
            byId.get(item.id) ?? { id: item.id, status: 'failed' },
            item,
            deps.implementation,
            now(),
          ),
        );
        await deps.saveRows(rows);
        processed += batch.length;
        emit({ type: 'progress', stage: 'checking', processed });
        await deps.checkpoint({ status: 'running', processed, total });
        await yieldToUi();
      }

      if (canceled) return 'canceled';
      emit({ type: 'progress', stage: 'grouping', processed });
      await deps.checkpoint({ status: 'succeeded', processed, total });
      emit({ type: 'succeed' });
      return 'succeeded';
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The analysis stopped unexpectedly';
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
