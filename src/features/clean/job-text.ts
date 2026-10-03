import { STAGE_LABEL, type Job } from '@/domain/jobs';

/** Title for a job anywhere it appears. Sample jobs always say so. */
export function jobTitle(job: Job): string {
  return job.sample ? 'Sample scan' : 'Scan';
}

function counts(job: Job): string {
  return job.total === null
    ? `${job.processed.toLocaleString()} checked`
    : `${job.processed.toLocaleString()} of ${job.total.toLocaleString()}`;
}

/** One-line status, e.g. "Checking photos · 48 of 112". Never claims unreported work. */
export function jobStatusLine(job: Job): string {
  switch (job.status) {
    case 'running':
      return job.stage === 'listing'
        ? STAGE_LABEL.listing
        : `${STAGE_LABEL[job.stage]} · ${counts(job)}`;
    case 'paused':
      return `Paused · ${counts(job)}`;
    case 'succeeded':
      return 'Done · Results are on the Clean tab';
    case 'canceled':
      return job.processed > 0 ? `Stopped · ${counts(job)} checked` : 'Stopped';
    case 'failed':
      return `Stopped · ${job.error ?? 'Something went wrong'}`;
  }
}

/** Spoken progress value for progress bars. */
export function jobProgressText(job: Job): string {
  return job.total === null
    ? 'Counting photos'
    : `${job.processed.toLocaleString()} of ${job.total.toLocaleString()} photos checked`;
}
