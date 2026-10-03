import { sampleLibrary } from '@/demo/sample-library';

import { FINISHED_JOB_VISIBLE_MS, useCleanSession } from './clean-session';

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(() => Promise.resolve()),
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light' },
  NotificationFeedbackType: { Success: 'success', Error: 'error' },
}));

const session = () => useCleanSession.getState();

beforeEach(() => {
  jest.useFakeTimers();
  session().reset();
});
afterEach(() => {
  session().reset();
  jest.useRealTimers();
});

test('a completed sample scan produces full sample results and then clears the job bar', () => {
  session().startSampleScan();
  expect(session().job?.status).toBe('running');
  for (let elapsed = 0; elapsed < 30_000 && session().job?.status === 'running'; elapsed += 50) {
    jest.advanceTimersByTime(50);
  }
  expect(session().job?.status).toBe('succeeded');
  expect(session().state).toMatchObject({
    status: 'results',
    analyzed: sampleLibrary.length,
    total: sampleLibrary.length,
  });
  jest.advanceTimersByTime(FINISHED_JOB_VISIBLE_MS);
  expect(session().job).toBeNull();
});

test('stopping mid-scan shows partial results limited to the photos checked', () => {
  session().startSampleScan();
  jest.advanceTimersByTime(1500);
  session().cancelScan();
  const { state, job } = session();
  expect(job?.status).toBe('canceled');
  expect(state.status).toBe('results');
  if (state.status !== 'results') return;
  expect(state.analyzed).toBe(job?.processed);
  expect(state.analyzed).toBeLessThan(state.total);
});

test('stopping before any photo is checked returns to not scanned', () => {
  session().startSampleScan();
  session().cancelScan();
  expect(session().state.status).toBe('not-scanned');
});

test('a second start while scanning is ignored', () => {
  session().startSampleScan();
  const first = session().job?.id;
  session().startSampleScan();
  expect(session().job?.id).toBe(first);
});

test('an active job cannot be dismissed, only stopped', () => {
  session().startSampleScan();
  session().dismissJob();
  expect(session().job).not.toBeNull();
});
