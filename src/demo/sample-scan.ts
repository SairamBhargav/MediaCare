import type { JobEvent } from '@/domain/jobs';

/**
 * Simulated scan of the sample library. It emits the same events a real
 * scan will (total, staged progress, success), paced by a timer so the
 * interaction can be judged on a device. Everything that shows it is
 * labelled "Sample scan"; it reads no photos and measures nothing.
 */
export type ScanControls = {
  pause: () => void;
  resume: () => void;
  cancel: () => void;
};

export type SampleScanOptions = {
  /** Milliseconds between progress events while checking. */
  tickMs?: number;
  /** Photos "checked" per tick. */
  perTick?: number;
  /** Time spent in the listing and grouping stages. */
  stageMs?: number;
};

export function runSampleScan(
  total: number,
  emit: (event: JobEvent) => void,
  { tickMs = 110, perTick = 3, stageMs = 650 }: SampleScanOptions = {},
): ScanControls {
  type Phase = 'listing' | 'checking' | 'grouping' | 'done';
  let phase: Phase = 'listing';
  let processed = 0;
  let paused = false;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const schedule = (ms: number) => {
    timer = setTimeout(step, ms);
  };

  function step() {
    timer = null;
    if (stopped || paused) return;
    switch (phase) {
      case 'listing':
        emit({ type: 'total-known', total });
        phase = 'checking';
        schedule(tickMs);
        return;
      case 'checking':
        processed = Math.min(total, processed + perTick);
        emit({ type: 'progress', stage: 'checking', processed });
        if (processed >= total) {
          phase = 'grouping';
          emit({ type: 'progress', stage: 'grouping', processed });
          schedule(stageMs);
        } else {
          schedule(tickMs);
        }
        return;
      case 'grouping':
        phase = 'done';
        emit({ type: 'succeed' });
        return;
      case 'done':
        return;
    }
  }

  emit({ type: 'progress', stage: 'listing', processed: 0 });
  schedule(stageMs);

  return {
    pause() {
      if (stopped || paused || phase === 'done') return;
      paused = true;
      if (timer) clearTimeout(timer);
      timer = null;
      emit({ type: 'pause' });
    },
    resume() {
      if (stopped || !paused) return;
      paused = false;
      emit({ type: 'resume' });
      schedule(tickMs);
    },
    cancel() {
      if (stopped || phase === 'done') return;
      stopped = true;
      if (timer) clearTimeout(timer);
      timer = null;
      emit({ type: 'cancel' });
    },
  };
}
