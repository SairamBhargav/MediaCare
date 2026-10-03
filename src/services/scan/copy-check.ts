import {
  FINGERPRINT_IMPLEMENTATION,
  MAX_FINGERPRINT_BYTES,
  candidateSets,
  confirmSet,
  isReusable,
  metadataSkipReason,
  provesCameraOriginal,
  type FingerprintRow,
  type SkipReason,
} from '@/domain/exact-copies';
import type { JobEvent } from '@/domain/jobs';
import type { PhotoItem } from '@/domain/media';

/**
 * "Find exact copies" (P2-DUP-001): a separate, user-started job over the
 * cataloged photos.
 *
 *  1. Listing: decide from metadata which photos can be checked at all
 *     (no file reads).
 *  2. Checking: for each eligible photo without a current fingerprint, in
 *     order: skip if it's stored only in iCloud (asked without network, so
 *     nothing downloads); get the file iOS hands over and skip unless it is
 *     provably the camera original; skip very large files; otherwise record
 *     byte size + MD5. Written in batches with a checkpoint and a yield.
 *  3. Grouping: files with equal size and MD5 are compared byte by byte;
 *     only identical files form a set. Sets are saved.
 *
 * Pause waits between photos; Stop keeps every fingerprint taken so far,
 * so running it again continues where it left off. Progress counts photos
 * actually handled. Dependencies are injected for testing.
 */
export type CopyCheckDeps = {
  listItems: () => Promise<readonly PhotoItem[]>;
  loadFingerprints: () => Promise<readonly FingerprintRow[]>;
  /** Asked without network access: never downloads. */
  isInCloud: (id: string) => Promise<boolean>;
  /** The file URI iOS hands over for the photo. */
  resolveUri: (id: string) => Promise<string>;
  /** Byte size of a local file, or null if it can't be read. */
  fileSize: (uri: string) => number | null;
  /** MD5 of a local file, read in chunks (bounded memory), or null. */
  fileMd5: (uri: string) => string | null;
  /** Full byte-by-byte comparison of two local files. */
  sameBytes: (uriA: string, uriB: string) => Promise<boolean>;
  saveFingerprints: (rows: readonly FingerprintRow[]) => Promise<void>;
  saveMatchGroups: (sets: readonly (readonly string[])[]) => Promise<void>;
  checkpoint: (state: {
    status: 'running' | 'paused' | 'succeeded' | 'canceled' | 'failed';
    processed: number;
    total: number | null;
    error?: string;
  }) => Promise<void>;
  now?: () => number;
};

export type CopyCheckControls = {
  pause: () => void;
  resume: () => void;
  cancel: () => void;
  done: Promise<'succeeded' | 'canceled' | 'failed'>;
};

const yieldToUi = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

export function runCopyCheck(
  deps: CopyCheckDeps,
  emit: (event: JobEvent) => void,
  { batchSize = 20 }: { batchSize?: number } = {},
): CopyCheckControls {
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

  /** One photo: a fingerprint, or the reason there isn't one. */
  const fingerprint = async (item: PhotoItem): Promise<FingerprintRow> => {
    const row = (
      status: FingerprintRow['status'],
      skipReason: SkipReason | null,
      byteSize: number | null = null,
      digest: string | null = null,
    ): FingerprintRow => ({
      assetId: item.id,
      assetVersion: item.version,
      status,
      skipReason,
      implementation: FINGERPRINT_IMPLEMENTATION,
      byteSize,
      digest,
      matchGroup: null,
      checkedAt: now(),
    });
    try {
      if (await deps.isInCloud(item.id)) return row('skipped', 'in-icloud');
      const uri = await deps.resolveUri(item.id);
      if (!provesCameraOriginal(uri, item.filename)) return row('skipped', 'not-original-file');
      // Size first, so oversized files are never hashed.
      const size = deps.fileSize(uri);
      if (size === null) return row('skipped', 'unreadable');
      if (size > MAX_FINGERPRINT_BYTES) return row('skipped', 'too-large', size);
      const md5 = deps.fileMd5(uri);
      if (!md5) return row('skipped', 'unreadable');
      return row('hashed', null, size, md5);
    } catch {
      return row('skipped', 'unreadable');
    }
  };

  const run = async (): Promise<'succeeded' | 'canceled' | 'failed'> => {
    try {
      emit({ type: 'progress', stage: 'listing', processed: 0 });
      const items = await deps.listItems();
      const stored = new Map((await deps.loadFingerprints()).map((row) => [row.assetId, row]));
      if (canceled) return 'canceled';

      const eligible = items.filter((item) => metadataSkipReason(item) === null);
      total = eligible.length;
      emit({ type: 'total-known', total });
      await deps.checkpoint({ status: 'running', processed, total });

      const current = new Map<string, FingerprintRow>();
      for (let start = 0; start < eligible.length; start += batchSize) {
        const batch = eligible.slice(start, start + batchSize);
        const written: FingerprintRow[] = [];
        for (const item of batch) {
          await waitWhilePaused();
          if (canceled) break;
          const previous = stored.get(item.id);
          if (previous && isReusable(previous, item)) {
            current.set(item.id, previous);
          } else {
            const next = await fingerprint(item);
            current.set(item.id, next);
            written.push(next);
          }
          processed += 1;
        }
        await deps.saveFingerprints(written);
        if (canceled) return 'canceled';
        emit({ type: 'progress', stage: 'checking', processed });
        await deps.checkpoint({ status: 'running', processed, total });
        await yieldToUi();
      }

      emit({ type: 'progress', stage: 'grouping', processed });
      const uris = new Map<string, string>();
      const uriFor = async (id: string) => {
        const known = uris.get(id);
        if (known) return known;
        const uri = await deps.resolveUri(id);
        uris.set(id, uri);
        return uri;
      };
      const byId = new Map(eligible.map((item) => [item.id, item]));
      const confirmed: string[][] = [];
      for (const candidates of candidateSets([...current.values()])) {
        await waitWhilePaused();
        if (canceled) return 'canceled';
        const sets = await confirmSet(candidates, async (a, b) => {
          const [uriA, uriB] = [await uriFor(a), await uriFor(b)];
          // Re-prove right before comparing: the photo may have changed since.
          if (
            !provesCameraOriginal(uriA, byId.get(a)?.filename ?? null) ||
            !provesCameraOriginal(uriB, byId.get(b)?.filename ?? null)
          ) {
            return false;
          }
          return deps.sameBytes(uriA, uriB);
        });
        confirmed.push(...sets);
        await yieldToUi();
      }
      await deps.saveMatchGroups(confirmed);
      await deps.checkpoint({ status: 'succeeded', processed, total });
      emit({ type: 'succeed' });
      return 'succeeded';
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The check stopped unexpectedly';
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
