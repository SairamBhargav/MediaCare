/**
 * Job state machine. Pure: the same reducer drives the simulated sample scan
 * now and real scans later. Progress only ever comes from events, never from
 * timers in the UI, so a job can't claim work it didn't report.
 *
 * Rules (tested in jobs.test.ts):
 *  - `processed` never goes backwards and never exceeds a known `total`.
 *  - Events that don't fit the current status are ignored (e.g. progress
 *    after cancel), so late or duplicate events can't corrupt state.
 *  - Finished jobs (succeeded / failed / canceled) never change again.
 */
export type JobStatus = 'running' | 'paused' | 'succeeded' | 'failed' | 'canceled';
export type JobStage = 'listing' | 'checking' | 'grouping';

export const JOB_STAGES: readonly JobStage[] = ['listing', 'checking', 'grouping'];

export type Job = {
  readonly id: string;
  readonly kind: 'scan';
  /** True for the simulated sample scan. Sample jobs never produce real statistics. */
  readonly sample: boolean;
  readonly status: JobStatus;
  readonly stage: JobStage;
  readonly processed: number;
  /** `null` while the total is unknown (indeterminate progress). */
  readonly total: number | null;
  readonly error?: string;
};

export type JobEvent =
  | { readonly type: 'total-known'; readonly total: number }
  | { readonly type: 'progress'; readonly stage: JobStage; readonly processed: number }
  | { readonly type: 'pause' }
  | { readonly type: 'resume' }
  | { readonly type: 'cancel' }
  | { readonly type: 'succeed' }
  | { readonly type: 'fail'; readonly message: string };

export function startJob(id: string, sample: boolean): Job {
  return {
    id,
    kind: 'scan',
    sample,
    status: 'running',
    stage: 'listing',
    processed: 0,
    total: null,
  };
}

export type ActiveJob = Job & { readonly status: 'running' | 'paused' };

export function isActive(job: Job | null): job is ActiveJob {
  return job !== null && (job.status === 'running' || job.status === 'paused');
}

export function reduceJob(job: Job, event: JobEvent): Job {
  if (!isActive(job)) return job;

  switch (event.type) {
    case 'total-known': {
      if (!Number.isInteger(event.total) || event.total < 0) return job;
      return { ...job, total: event.total, processed: Math.min(job.processed, event.total) };
    }
    case 'progress': {
      if (job.status !== 'running') return job;
      const ceiling = job.total ?? Number.POSITIVE_INFINITY;
      const processed = Math.min(Math.max(job.processed, event.processed), ceiling);
      // Stages only move forward.
      const stage =
        JOB_STAGES.indexOf(event.stage) > JOB_STAGES.indexOf(job.stage) ? event.stage : job.stage;
      return { ...job, processed, stage };
    }
    case 'pause':
      return job.status === 'running' ? { ...job, status: 'paused' } : job;
    case 'resume':
      return job.status === 'paused' ? { ...job, status: 'running' } : job;
    case 'cancel':
      return { ...job, status: 'canceled' };
    case 'succeed':
      return { ...job, status: 'succeeded', processed: job.total ?? job.processed };
    case 'fail':
      return { ...job, status: 'failed', error: event.message };
  }
}

/** 0–1 when the total is known, otherwise `null` (show an indeterminate indicator). */
export function jobFraction(job: Job): number | null {
  if (job.total === null) return null;
  if (job.total === 0) return 1;
  return job.processed / job.total;
}

export const STAGE_LABEL: Record<JobStage, string> = {
  listing: 'Finding photos',
  checking: 'Checking photos',
  grouping: 'Grouping results',
};
