import { AccessibilityInfo } from 'react-native';
import { create } from 'zustand';

import { sampleFindings, sampleLibrary } from '@/demo/sample-library';
import { runSampleScan, type ScanControls } from '@/demo/sample-scan';
import { findingsWithin, type Finding } from '@/domain/findings';
import { isActive, reduceJob, startJob, type Job, type JobEvent } from '@/domain/jobs';
import { haptics } from '@/utils/haptics';

/**
 * What the Clean home shows when no scan is running. `results` covers three
 * visible states: complete (analyzed === total), partial (analyzed < total,
 * e.g. a stopped scan) and no findings (empty `findings`). While a scan runs,
 * the active `job` is shown on top of this.
 */
export type CleanHomeState =
  | { readonly status: 'not-scanned' }
  | {
      readonly status: 'results';
      /** Always true in Phase 1. Real results arrive in Phase 2–3. */
      readonly sample: true;
      readonly analyzed: number;
      readonly total: number;
      readonly findings: readonly Finding[];
    }
  | { readonly status: 'failed'; readonly message: string };

type CleanSession = {
  state: CleanHomeState;
  /** The current or just-finished scan. Drives the job bar and scan sheet. */
  job: Job | null;
  startSampleScan: () => void;
  pauseScan: () => void;
  resumeScan: () => void;
  cancelScan: () => void;
  /** Hide a finished job from the job bar. Active jobs can't be dismissed, only stopped. */
  dismissJob: () => void;
  /** Jump straight to complete sample results (tests and dev gallery). */
  showSampleResults: () => void;
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

/** Results for the first `processed` photos in scan order (newest first). */
function partialResults(processed: number): CleanHomeState {
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

let controls: ScanControls | null = null;
let dismissTimer: ReturnType<typeof setTimeout> | null = null;

/** Session-only: sample results are not persisted and never mix with real data. */
export const useCleanSession = create<CleanSession>()((set, get) => {
  const scheduleDismiss = (jobId: string) => {
    if (dismissTimer) clearTimeout(dismissTimer);
    dismissTimer = setTimeout(() => {
      if (get().job?.id === jobId) set({ job: null });
    }, FINISHED_JOB_VISIBLE_MS);
  };

  const onEvent = (jobId: string) => (event: JobEvent) => {
    const current = get().job;
    if (!current || current.id !== jobId) return;
    const job = reduceJob(current, event);
    if (job === current) return;

    if (job.status === 'succeeded') {
      controls = null;
      set({ job, state: sampleResultsState });
      haptics.success();
      AccessibilityInfo.announceForAccessibility('Sample scan complete');
      scheduleDismiss(job.id);
    } else if (job.status === 'canceled') {
      controls = null;
      set({ job, state: partialResults(job.processed) });
      AccessibilityInfo.announceForAccessibility(
        job.processed > 0 ? 'Scan stopped. Results so far are shown.' : 'Scan stopped.',
      );
      scheduleDismiss(job.id);
    } else {
      set({ job });
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
      controls = runSampleScan(sampleLibrary.length, onEvent(job.id));
    },
    pauseScan: () => controls?.pause(),
    resumeScan: () => controls?.resume(),
    cancelScan: () => controls?.cancel(),
    dismissJob: () => {
      if (!isActive(get().job)) set({ job: null });
    },
    showSampleResults: () => set({ state: sampleResultsState }),
    reset: () => {
      controls?.cancel();
      controls = null;
      if (dismissTimer) clearTimeout(dismissTimer);
      set({ state: { status: 'not-scanned' }, job: null });
    },
  };
});
