import type { SizeRow } from '@/db/catalog-repo';
import type { CloudBlock } from '@/domain/icloud';
import type { JobEvent } from '@/domain/jobs';
import type { PhotoItem } from '@/domain/media';
import {
  isAnalyzable,
  isReusableVisual,
  rowFromNative,
  type NativeAnalysis,
  type VisualRow,
} from '@/domain/visual-records';
import { yieldToUi } from '@/utils/yield-to-ui';

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
 * Photos stored only in iCloud are reported, never downloaded, unless the
 * user opted in (ADR-0009, `cloud`): then they are tried again last, a
 * small batch at a time, while the connection allows it. Pause waits
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
  /**
   * Optional last step: measure video file sizes (app builds with the
   * creation tools). Only videos without a size for their current version.
   */
  videoSizes?: {
    load: () => Promise<readonly SizeRow[]>;
    measure: (ids: string[]) => Promise<{ id: string; status: string; bytes?: number }[]>;
    save: (rows: readonly SizeRow[]) => Promise<void>;
  };
  /** Opt-in iCloud pass (ADR-0009). Absent: iCloud photos stay "in iCloud only". */
  cloud?: CloudPass<NativeAnalysis>;
  /** People (ADR-0011): faces of photos with faces are fingerprinted, then grouped. */
  people?: PeopleStep;
};

export const PEOPLE_STEP = 'Finding people';

export type PeopleStep = {
  /** Asset ids whose face scan is current (same version and method). */
  scanned: () => Promise<ReadonlySet<string>>;
  /** Fingerprints faces; `allowNetwork` only while the iCloud pass allows it. */
  find: (ids: string[], allowNetwork: boolean) => Promise<{ id: string; status: string }[]>;
  /** Saves a batch of results (unfinished ones, like still in iCloud, are skipped by the caller). */
  save: (
    items: readonly PhotoItem[],
    results: readonly { id: string; status: string }[],
  ) => Promise<void>;
  /** Groups faces into people; called once if any faces were saved. */
  group: () => Promise<void>;
};

export const ICLOUD_STEP = 'Getting photos from iCloud';

/** Retrying photos that are only in iCloud, with downloads allowed. */
export type CloudPass<Result> = {
  /** Checked before every batch: why downloading isn't allowed now, or null. */
  blocked: () => Promise<CloudBlock | null>;
  run: (ids: string[]) => Promise<Result[]>;
  /** The pass stopped early for this reason; the rest stay in iCloud for next time. */
  onBlocked: (reason: CloudBlock) => void;
};

export type VisualJobControls = {
  pause: () => void;
  resume: () => void;
  cancel: () => void;
  done: Promise<'succeeded' | 'canceled' | 'failed'>;
};

export function runVisualAnalysis(
  deps: VisualJobDeps,
  emit: (event: JobEvent) => void,
  {
    batchSize = 8,
    cloudBatchSize = 4,
    peopleBatchSize = 4,
  }: { batchSize?: number; cloudBatchSize?: number; peopleBatchSize?: number } = {},
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
      const listed = await deps.listItems();
      const items = listed.filter(isAnalyzable);
      const stored = new Map((await deps.loadRows()).map((row) => [row.assetId, row]));
      let videos: PhotoItem[] = [];
      if (deps.videoSizes) {
        const sizes = new Map((await deps.videoSizes.load()).map((row) => [row.assetId, row]));
        videos = listed.filter((item) => {
          if (item.kind !== 'video') return false;
          const row = sizes.get(item.id);
          return !row || row.assetVersion !== item.version;
        });
      }
      if (canceled) return 'canceled';

      total = items.length + videos.length;
      emit({ type: 'total-known', total });
      await deps.checkpoint({ status: 'running', processed, total });

      const todo: PhotoItem[] = [];
      for (const item of items) {
        const row = stored.get(item.id);
        if (row && isReusableVisual(row, item, deps.implementation)) processed += 1;
        else todo.push(item);
      }
      emit({ type: 'progress', stage: 'checking', processed });

      // With the iCloud pass on, iCloud-only photos are counted when that pass handles them.
      const inCloud: PhotoItem[] = [];
      const toRows = (batch: readonly PhotoItem[], results: readonly NativeAnalysis[]) => {
        const byId = new Map(results.map((result) => [result.id, result]));
        return batch.map((item) =>
          rowFromNative(
            byId.get(item.id) ?? { id: item.id, status: 'failed' },
            item,
            deps.implementation,
            now(),
          ),
        );
      };

      for (let start = 0; start < todo.length; start += batchSize) {
        await waitWhilePaused();
        if (canceled) return 'canceled';
        const batch = todo.slice(start, start + batchSize);
        const rows = toRows(batch, await deps.analyze(batch.map((item) => item.id)));
        await deps.saveRows(rows);
        const deferred = deps.cloud ? batch.filter((_, i) => rows[i].status === 'in-icloud') : [];
        inCloud.push(...deferred);
        processed += batch.length - deferred.length;
        emit({ type: 'progress', stage: 'checking', processed });
        await deps.checkpoint({ status: 'running', processed, total });
        await yieldToUi();
      }

      const sizer = deps.videoSizes;
      for (let start = 0; sizer && start < videos.length; start += batchSize) {
        await waitWhilePaused();
        if (canceled) return 'canceled';
        const batch = videos.slice(start, start + batchSize);
        const results = new Map(
          (await sizer.measure(batch.map((item) => item.id))).map((result) => [result.id, result]),
        );
        await sizer.save(
          batch.map((item) => {
            const result = results.get(item.id);
            return {
              assetId: item.id,
              assetVersion: item.version,
              status: result?.status ?? 'failed',
              bytes: result?.status === 'ok' ? (result.bytes ?? null) : null,
              measuredAt: now(),
            };
          }),
        );
        processed += batch.length;
        emit({ type: 'progress', stage: 'checking', processed });
        await deps.checkpoint({ status: 'running', processed, total });
        await yieldToUi();
      }

      const cloud = deps.cloud;
      if (cloud && inCloud.length > 0) {
        let fetched = 0;
        emit({ type: 'step-progress', label: ICLOUD_STEP, done: 0, total: inCloud.length });
        for (let start = 0; start < inCloud.length; start += cloudBatchSize) {
          await waitWhilePaused();
          if (canceled) return 'canceled';
          const reason = await cloud.blocked();
          if (reason) {
            cloud.onBlocked(reason);
            processed += inCloud.length - fetched;
            break;
          }
          const batch = inCloud.slice(start, start + cloudBatchSize);
          await deps.saveRows(toRows(batch, await cloud.run(batch.map((item) => item.id))));
          fetched += batch.length;
          processed += batch.length;
          emit({ type: 'step-progress', label: ICLOUD_STEP, done: fetched, total: inCloud.length });
          emit({ type: 'progress', stage: 'checking', processed });
          await deps.checkpoint({ status: 'running', processed, total });
          await yieldToUi();
        }
      }

      const people = deps.people;
      if (people) {
        const done = await people.scanned();
        const withFaces = new Map(
          (await deps.loadRows())
            .filter((row) => row.status === 'ok' && row.faces.length > 0)
            .map((row) => [row.assetId, row]),
        );
        const todo = items.filter((item) => {
          const row = withFaces.get(item.id);
          return row !== undefined && row.assetVersion === item.version && !done.has(item.id);
        });
        let found = 0;
        let allowNetwork = cloud !== undefined;
        let saved = false;
        if (todo.length > 0)
          emit({ type: 'step-progress', label: PEOPLE_STEP, done: 0, total: todo.length });
        for (let start = 0; start < todo.length; start += peopleBatchSize) {
          await waitWhilePaused();
          if (canceled) return 'canceled';
          if (allowNetwork && cloud && (await cloud.blocked())) allowNetwork = false;
          const batch = todo.slice(start, start + peopleBatchSize);
          const results = await people.find(
            batch.map((item) => item.id),
            allowNetwork,
          );
          await people.save(batch, results);
          saved = saved || results.some((result) => result.status === 'ok');
          found += batch.length;
          emit({ type: 'step-progress', label: PEOPLE_STEP, done: found, total: todo.length });
          await yieldToUi();
        }
        if (canceled) return 'canceled';
        if (saved) await people.group();
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
