import { isActive, jobFraction, reduceJob, startJob, type Job, type JobEvent } from './jobs';

function run(events: JobEvent[], start: Job = startJob('j1', true)): Job {
  return events.reduce(reduceJob, start);
}

test('a new job is running with an unknown total', () => {
  const job = startJob('j1', true);
  expect(job).toMatchObject({ status: 'running', stage: 'listing', processed: 0, total: null });
  expect(jobFraction(job)).toBeNull();
});

test('progress is clamped to the known total and never goes backwards', () => {
  const job = run([
    { type: 'total-known', total: 100 },
    { type: 'progress', stage: 'checking', processed: 60 },
    { type: 'progress', stage: 'checking', processed: 40 },
    { type: 'progress', stage: 'checking', processed: 250 },
  ]);
  expect(job.processed).toBe(100);
  expect(jobFraction(job)).toBe(1);
});

test('stages only move forward', () => {
  const job = run([
    { type: 'progress', stage: 'grouping', processed: 1 },
    { type: 'progress', stage: 'listing', processed: 2 },
  ]);
  expect(job.stage).toBe('grouping');
});

test('paused jobs ignore progress until resumed', () => {
  const paused = run([
    { type: 'total-known', total: 10 },
    { type: 'progress', stage: 'checking', processed: 3 },
    { type: 'pause' },
    { type: 'progress', stage: 'checking', processed: 7 },
  ]);
  expect(paused).toMatchObject({ status: 'paused', processed: 3 });
  const resumed = run(
    [{ type: 'resume' }, { type: 'progress', stage: 'checking', processed: 7 }],
    paused,
  );
  expect(resumed).toMatchObject({ status: 'running', processed: 7 });
});

test('a canceled job keeps its progress and ignores late events', () => {
  const job = run([
    { type: 'total-known', total: 10 },
    { type: 'progress', stage: 'checking', processed: 4 },
    { type: 'cancel' },
    { type: 'progress', stage: 'checking', processed: 9 },
    { type: 'succeed' },
  ]);
  expect(job).toMatchObject({ status: 'canceled', processed: 4 });
  expect(isActive(job)).toBe(false);
});

test('success completes the count; failure keeps the message', () => {
  expect(run([{ type: 'total-known', total: 5 }, { type: 'succeed' }]).processed).toBe(5);
  expect(run([{ type: 'fail', message: 'Access revoked' }])).toMatchObject({
    status: 'failed',
    error: 'Access revoked',
  });
});

test('invalid totals are ignored', () => {
  expect(run([{ type: 'total-known', total: -3 }]).total).toBeNull();
  expect(run([{ type: 'total-known', total: 2.5 }]).total).toBeNull();
});

test('an empty library is complete, not divide-by-zero', () => {
  expect(jobFraction(run([{ type: 'total-known', total: 0 }]))).toBe(1);
});
