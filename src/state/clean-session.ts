import { AccessibilityInfo } from 'react-native';
import { create } from 'zustand';

import {
  loadFingerprints,
  loadVersions,
  markSeen,
  removeUnseen,
  saveFingerprints,
  saveMatchGroups,
  loadVisualRows,
  saveScanJob,
  saveVisualRows,
  upsertAssets,
} from '@/db/catalog-repo';
import { sampleFindings, sampleLibrary } from '@/demo/sample-library';
import { runSampleScan } from '@/demo/sample-scan';
import { exactCopyFindings } from '@/domain/exact-copies';
import { findingsWithin, type Finding } from '@/domain/findings';
import { isActive, reduceJob, startJob, type Job, type JobEvent } from '@/domain/jobs';
import type { PhotoItem } from '@/domain/media';
import { favoriteIds, findLongVideos, findMoments, findScreenshots } from '@/domain/real-findings';
import { qualityFlags, similarFindings } from '@/domain/visual-findings';
import { currentScores } from '@/domain/visual-records';
import {
  fileMd5,
  fileSize,
  isInCloud,
  resolveUri,
  sameBytes,
} from '@/services/media/file-fingerprint';
import { getSubtypes, listAllMetadata, toRecord } from '@/services/media/photo-library';
import {
  ANALYSIS_IMPLEMENTATION,
  analyzePhotos,
  hashOriginals,
  originalsHashingAvailable,
  visualAnalysisAvailable,
} from '@/services/media/visual-analysis';
import { runCopyCheck } from '@/services/scan/copy-check';
import { runVisualAnalysis } from '@/services/scan/visual-analysis-job';
import { runLibraryScan } from '@/services/scan/library-scan';
import { haptics } from '@/utils/haptics';

import { hasPhotoAccess, useCatalog } from './catalog';
import { useReviewSession } from './review-session';

/** New or cleared results invalidate review choices made on the old ones. */
function clearReview(protectedIds?: Iterable<string>) {
  const review = useReviewSession.getState();
  review.reset();
  if (protectedIds) review.seedProtected(protectedIds);
}

/**
 * What the Clean home shows when no scan is running. `results` covers three
 * visible states: complete (analyzed === total), partial (analyzed < total,
 * e.g. a stopped scan) and no findings (empty `findings`). While a scan runs,
 * the active `job` is shown on top of this.
 *
 * `sample: true` results come from the synthetic sample library and show
 * illustrative sizes. `sample: false` results come from the real catalog and
 * never claim sizes, which aren't measured in Phase 2.
 */
export type CleanHomeState =
  | { readonly status: 'not-scanned' }
  | {
      readonly status: 'results';
      readonly sample: boolean;
      readonly analyzed: number;
      readonly total: number;
      readonly findings: readonly Finding[];
    }
  | { readonly status: 'failed'; readonly message: string };

type ScanHandle = { pause: () => void; resume: () => void; cancel: () => void };

type CleanSession = {
  state: CleanHomeState;
  /** The current or just-finished scan. Drives the job bar and scan sheet. */
  job: Job | null;
  startSampleScan: () => void;
  /** Real scan of the accessible Photos library; asks for access first if needed. */
  startLibraryScan: () => Promise<void>;
  /**
   * "Find exact copies" over the cataloged photos (P2-DUP-001). Started
   * only by the user; needs photo access and a catalog. Pause, resume and
   * stop use the same controls as a scan.
   */
  startCopyCheck: () => void;
  /** On-device visual analysis (Apple Vision); only in the MediaCare app build. */
  startVisualAnalysis: () => void;
  pauseScan: () => void;
  resumeScan: () => void;
  cancelScan: () => void;
  /** Hide a finished job from the job bar. Active jobs can't be dismissed, only stopped. */
  dismissJob: () => void;
  /** Jump straight to complete sample results (tests and dev gallery). */
  showSampleResults: () => void;
  /** Show results computed from the catalog already on this iPhone. */
  showCatalogResults: () => void;
  reset: () => void;
};

export const sampleResultsState: Extract<CleanHomeState, { status: 'results' }> = {
  status: 'results',
  sample: true,
  analyzed: sampleLibrary.length,
  total: sampleLibrary.length,
  findings: sampleFindings,
};

/** A finished job stays visible in the job bar this long, then clears itself. */
export const FINISHED_JOB_VISIBLE_MS = 4000;

/** Sample results for the first `processed` photos in scan order (newest first). */
function partialSampleResults(processed: number): CleanHomeState {
  if (processed <= 0) return { status: 'not-scanned' };
  const checked = new Set(sampleLibrary.slice(0, processed).map((asset) => asset.id));
  return {
    status: 'results',
    sample: true,
    analyzed: processed,
    total: sampleLibrary.length,
    findings: findingsWithin(sampleFindings, checked),
  };
}

function catalogResults(
  items: readonly PhotoItem[],
  analyzed: number,
  total: number,
): CleanHomeState {
  return { status: 'results', sample: false, analyzed, total, findings: realFindings(items) };
}

/**
 * Real findings. Once photos have been looked at (visual analysis), similar
 * shots come from how photos look and replace the timing-only "moments";
 * blur, closed eyes and exposure flags are added. Exact copies come from
 * the last copies check.
 */
function realFindings(items: readonly PhotoItem[]): Finding[] {
  const { copySets, byId, visualRows } = useCatalog.getState();
  const scores = currentScores(items, visualRows, ANALYSIS_IMPLEMENTATION);
  const visual = scores.size > 0;
  return [
    ...(visual ? similarFindings(items, scores) : findMoments(items)),
    ...exactCopyFindings(copySets, byId),
    ...(visual ? qualityFlags(items, scores) : []),
    ...findScreenshots(items),
    ...findLongVideos(items),
  ];
}

function catalogProtection(items: readonly PhotoItem[]): Set<string> {
  return new Set([...useCatalog.getState().protectedIds, ...favoriteIds(items)]);
}

let controls: ScanHandle | null = null;
let dismissTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Session state for the Clean tab. Sample results are never persisted and
 * never mix with real data; real results are recomputed from the catalog.
 */
export const useCleanSession = create<CleanSession>()((set, get) => {
  const scheduleDismiss = (jobId: string) => {
    if (dismissTimer) clearTimeout(dismissTimer);
    dismissTimer = setTimeout(() => {
      if (get().job?.id === jobId) set({ job: null });
    }, FINISHED_JOB_VISIBLE_MS);
  };

  /** Applies job events; `finish` runs once when the job reaches a final state. */
  const onEvent =
    (jobId: string, finish: (job: Job) => void | Promise<void>) => (event: JobEvent) => {
      const current = get().job;
      if (!current || current.id !== jobId) return;
      const job = reduceJob(current, event);
      if (job === current) return;
      set({ job });
      if (!isActive(job)) {
        controls = null;
        const finished = finish(job);
        if (finished instanceof Promise) finished.finally(() => scheduleDismiss(job.id));
        else scheduleDismiss(job.id);
      }
    };

  const finishSample = (job: Job) => {
    if (job.status === 'succeeded') {
      clearReview();
      set({ state: sampleResultsState });
      haptics.success();
      AccessibilityInfo.announceForAccessibility('Sample scan complete');
    } else if (job.status === 'canceled') {
      clearReview();
      set({ state: partialSampleResults(job.processed) });
      AccessibilityInfo.announceForAccessibility(
        job.processed > 0 ? 'Scan stopped. Results so far are shown.' : 'Scan stopped.',
      );
    }
  };

  const finishLibrary = async (job: Job) => {
    await useCatalog.getState().load();
    const { items } = useCatalog.getState();
    if (job.status === 'failed') {
      haptics.error();
      AccessibilityInfo.announceForAccessibility('Scan stopped because of an error');
      // With nothing cataloged there are no results to fall back on.
      if (items.length === 0) {
        set({
          state: { status: 'failed', message: job.error ?? 'The scan stopped unexpectedly.' },
        });
        return;
      }
    }
    clearReview(catalogProtection(items));
    const total = job.total ?? items.length;
    set({
      state:
        items.length === 0 && job.status !== 'succeeded'
          ? { status: 'not-scanned' }
          : catalogResults(items, job.status === 'succeeded' ? total : job.processed, total),
    });
    if (job.status === 'succeeded') {
      haptics.success();
      AccessibilityInfo.announceForAccessibility('Library scan complete');
    } else if (job.status === 'canceled') {
      AccessibilityInfo.announceForAccessibility('Scan stopped. Results so far are shown.');
    }
  };

  const finishCopies = async (job: Job) => {
    await useCatalog.getState().load();
    const { items, copySets } = useCatalog.getState();
    const state = get().state;
    if (state.status === 'results' && !state.sample) {
      // Other findings keep their ids, so review choices on them stay valid.
      set({ state: { ...state, findings: realFindings(items) } });
    } else {
      get().showCatalogResults();
    }
    if (job.status === 'succeeded') {
      haptics.success();
      AccessibilityInfo.announceForAccessibility(
        copySets.length === 0
          ? 'Exact copies check complete. No exact copies found.'
          : `Exact copies check complete. ${copySets.length} ${copySets.length === 1 ? 'set' : 'sets'} found.`,
      );
    } else if (job.status === 'failed') {
      haptics.error();
      AccessibilityInfo.announceForAccessibility('Exact copies check stopped because of an error');
    } else if (job.status === 'canceled') {
      AccessibilityInfo.announceForAccessibility(
        'Check stopped. Photos checked so far are kept for next time.',
      );
    }
  };

  const finishAnalysis = async (job: Job) => {
    await useCatalog.getState().load();
    const { items } = useCatalog.getState();
    const state = get().state;
    if (state.status === 'results' && !state.sample) {
      // Similar groups change when photos are looked at, so earlier review
      // choices on groups no longer line up; protection carries over.
      clearReview(catalogProtection(items));
      set({ state: { ...state, findings: realFindings(items) } });
    } else {
      get().showCatalogResults();
    }
    if (job.status === 'succeeded') {
      haptics.success();
      AccessibilityInfo.announceForAccessibility('Photo check complete');
    } else if (job.status === 'failed') {
      haptics.error();
      AccessibilityInfo.announceForAccessibility('Photo check stopped because of an error');
    } else if (job.status === 'canceled') {
      AccessibilityInfo.announceForAccessibility(
        'Photo check stopped. Photos looked at so far are kept for next time.',
      );
    }
  };

  return {
    state: { status: 'not-scanned' },
    job: null,

    startSampleScan: () => {
      if (isActive(get().job)) return;
      if (dismissTimer) clearTimeout(dismissTimer);
      const job = startJob(`sample-scan-${Date.now()}`, true);
      set({ job });
      controls = runSampleScan(sampleLibrary.length, onEvent(job.id, finishSample));
    },

    startLibraryScan: async () => {
      if (isActive(get().job)) return;
      const catalog = useCatalog.getState();
      let access = catalog.access;
      if (!hasPhotoAccess(access)) access = await catalog.requestAccess();
      if (!hasPhotoAccess(access)) return;
      if (dismissTimer) clearTimeout(dismissTimer);

      const job = startJob(`library-scan-${Date.now()}`, false);
      const startedAt = Date.now();
      set({ job });
      controls = runLibraryScan(
        job.id,
        {
          listAllMetadata,
          getSubtypes,
          toRecord,
          loadVersions,
          upsertAssets,
          markSeen,
          removeUnseen,
          checkpoint: ({ status, processed, total, error }) =>
            saveScanJob({
              id: job.id,
              status,
              processed,
              total,
              startedAt,
              finishedAt: status === 'running' || status === 'paused' ? null : Date.now(),
              error: error ?? null,
            }),
        },
        onEvent(job.id, finishLibrary),
      );
    },

    startCopyCheck: () => {
      if (isActive(get().job)) return;
      const catalog = useCatalog.getState();
      if (!hasPhotoAccess(catalog.access) || catalog.items.length === 0) return;
      if (dismissTimer) clearTimeout(dismissTimer);

      const job = startJob(`copy-check-${Date.now()}`, false, 'copies');
      const startedAt = Date.now();
      set({ job });
      controls = runCopyCheck(
        {
          listItems: async () => useCatalog.getState().items,
          loadFingerprints,
          isInCloud,
          resolveUri,
          fileSize,
          fileMd5,
          sameBytes,
          hashOriginals: originalsHashingAvailable() ? hashOriginals : undefined,
          saveFingerprints,
          saveMatchGroups,
          checkpoint: ({ status, processed, total, error }) =>
            saveScanJob({
              id: job.id,
              kind: 'copy-check',
              status,
              processed,
              total,
              startedAt,
              finishedAt: status === 'running' || status === 'paused' ? null : Date.now(),
              error: error ?? null,
            }),
        },
        onEvent(job.id, finishCopies),
      );
    },

    startVisualAnalysis: () => {
      if (isActive(get().job) || !visualAnalysisAvailable()) return;
      const catalog = useCatalog.getState();
      if (!hasPhotoAccess(catalog.access) || catalog.items.length === 0) return;
      if (dismissTimer) clearTimeout(dismissTimer);

      const job = startJob(`visual-analysis-${Date.now()}`, false, 'analysis');
      const startedAt = Date.now();
      set({ job });
      controls = runVisualAnalysis(
        {
          listItems: async () => useCatalog.getState().items,
          loadRows: loadVisualRows,
          analyze: analyzePhotos,
          saveRows: saveVisualRows,
          implementation: ANALYSIS_IMPLEMENTATION,
          checkpoint: ({ status, processed, total, error }) =>
            saveScanJob({
              id: job.id,
              kind: 'visual-analysis',
              status,
              processed,
              total,
              startedAt,
              finishedAt: status === 'running' || status === 'paused' ? null : Date.now(),
              error: error ?? null,
            }),
        },
        onEvent(job.id, finishAnalysis),
      );
    },

    pauseScan: () => controls?.pause(),
    resumeScan: () => controls?.resume(),
    cancelScan: () => controls?.cancel(),
    dismissJob: () => {
      if (!isActive(get().job)) set({ job: null });
    },
    showSampleResults: () => {
      clearReview();
      set({ state: sampleResultsState });
    },
    showCatalogResults: () => {
      const { items, lastScan } = useCatalog.getState();
      if (items.length === 0) return;
      clearReview(catalogProtection(items));
      const total = lastScan?.total ?? items.length;
      const analyzed =
        lastScan?.status === 'succeeded' ? total : (lastScan?.processed ?? items.length);
      set({ state: catalogResults(items, Math.min(analyzed, total), total) });
    },
    reset: () => {
      controls?.cancel();
      controls = null;
      if (dismissTimer) clearTimeout(dismissTimer);
      clearReview();
      set({ state: { status: 'not-scanned' }, job: null });
    },
  };
});
