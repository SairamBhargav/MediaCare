import { create } from 'zustand';

import { sampleFindings, sampleLibrary } from '@/demo/sample-library';
import type { Finding } from '@/domain/findings';

/**
 * What the Clean home shows. `results` covers three visible states:
 * complete (analyzed === total), partial (analyzed < total) and no findings
 * (empty `findings`). Scanning progress joins in P1-JOB-001.
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

/** Session-only: sample results are not persisted and never mix with real data. */
export const useCleanSession = create<CleanSession>()((set) => ({
  state: { status: 'not-scanned' },
  showSampleResults: () => set({ state: sampleResultsState }),
  reset: () => set({ state: { status: 'not-scanned' } }),
}));
