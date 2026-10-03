import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { reduceJob, startJob, type Job, type JobEvent } from '@/domain/jobs';
import { useCleanSession } from '@/state/clean-session';

import { ActiveJobBar } from './active-job-bar';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), navigate: jest.fn() } }));

function jobAfter(events: JobEvent[]): Job {
  return events.reduce(reduceJob, startJob('j', true));
}

const running = jobAfter([
  { type: 'total-known', total: 112 },
  { type: 'progress', stage: 'checking', processed: 48 },
]);

beforeEach(() => jest.clearAllMocks());

test('a running sample scan says what it is, where it is, and opens details', async () => {
  await render(<ActiveJobBar job={running} />);
  const bar = screen.getByLabelText('Sample scan. Checking photos · 48 of 112.');
  await fireEvent.press(bar);
  expect(router.push).toHaveBeenCalledWith('/scan');
});

test('the trailing control pauses a running scan and resumes a paused one', async () => {
  const pauseScan = jest.spyOn(useCleanSession.getState(), 'pauseScan');
  await render(<ActiveJobBar job={running} />);
  await fireEvent.press(screen.getByLabelText('Pause scan'));
  expect(pauseScan).toHaveBeenCalled();

  const resumeScan = jest.spyOn(useCleanSession.getState(), 'resumeScan');
  await render(<ActiveJobBar job={reduceJob(running, { type: 'pause' })} />);
  await fireEvent.press(screen.getByLabelText('Resume scan'));
  expect(resumeScan).toHaveBeenCalled();
});

test('a finished scan offers its results and can be dismissed', async () => {
  const done = reduceJob(running, { type: 'succeed' });
  await render(<ActiveJobBar job={done} />);
  await fireEvent.press(screen.getByLabelText(/^Sample scan\. Done/));
  expect(router.navigate).toHaveBeenCalledWith('/');
  expect(screen.getByLabelText('Dismiss')).toBeOnTheScreen();
  expect(screen.queryByRole('progressbar')).toBeNull();
});
