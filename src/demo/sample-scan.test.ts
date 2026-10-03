import { reduceJob, startJob, type Job, type JobEvent } from '@/domain/jobs';

import { runSampleScan } from './sample-scan';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

function harness(total: number) {
  const events: JobEvent[] = [];
  let job: Job = startJob('scan', true);
  const controls = runSampleScan(
    total,
    (event) => {
      events.push(event);
      job = reduceJob(job, event);
    },
    { tickMs: 10, perTick: 4, stageMs: 50 },
  );
  return { events, controls, job: () => job };
}

test('runs listing → checking → grouping → success with honest counts', () => {
  const { job, events } = harness(10);
  expect(job()).toMatchObject({ stage: 'listing', total: null });
  jest.advanceTimersByTime(50);
  expect(job().total).toBe(10);
  jest.advanceTimersByTime(30);
  expect(job()).toMatchObject({ stage: 'grouping', processed: 10 });
  jest.advanceTimersByTime(50);
  expect(job().status).toBe('succeeded');
  const processedValues = events.flatMap((event) =>
    event.type === 'progress' ? [event.processed] : [],
  );
  expect(processedValues).toEqual([...processedValues].sort((a, b) => a - b));
});

test('pause stops progress until resume', () => {
  const { job, controls } = harness(40);
  jest.advanceTimersByTime(70);
  controls.pause();
  const atPause = job().processed;
  jest.advanceTimersByTime(1000);
  expect(job()).toMatchObject({ status: 'paused', processed: atPause });
  controls.resume();
  jest.advanceTimersByTime(20);
  expect(job().processed).toBeGreaterThan(atPause);
});

test('cancel stops for good and keeps the progress made', () => {
  const { job, controls } = harness(40);
  jest.advanceTimersByTime(80);
  controls.cancel();
  const atCancel = job().processed;
  jest.advanceTimersByTime(5000);
  expect(job()).toMatchObject({ status: 'canceled', processed: atCancel });
  controls.resume();
  expect(job().status).toBe('canceled');
});
