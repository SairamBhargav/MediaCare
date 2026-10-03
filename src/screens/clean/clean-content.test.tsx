import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { sampleBytes, sampleFindings } from '@/demo/sample-library';
import { formatBytes } from '@/domain/bytes';
import { totalReclaimableBytes } from '@/domain/findings';
import { sampleResultsState, type CleanHomeState } from '@/state/clean-session';

import { CleanContent } from './clean-content';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

function renderState(state: CleanHomeState) {
  const handlers = { onShowSample: jest.fn(), onReset: jest.fn() };
  return { handlers, result: render(<CleanContent state={state} {...handlers} />) };
}

test('not scanned: explains, says there is no photo access, and offers the sample', async () => {
  const { handlers, result } = renderState({ status: 'not-scanned' });
  await result;
  expect(screen.getByText('Not scanned')).toBeOnTheScreen();
  expect(screen.getByText(/doesn’t ask for photo access/)).toBeOnTheScreen();
  await fireEvent.press(screen.getByLabelText('Explore sample results'));
  expect(handlers.onShowSample).toHaveBeenCalledTimes(1);
});

test('results: total counts each photo once and every category card is labelled sample', async () => {
  await renderState(sampleResultsState).result;
  const total = formatBytes(totalReclaimableBytes(sampleFindings, sampleBytes));
  expect(screen.getByText(`Could free up to ${total}`)).toBeOnTheScreen();
  expect(screen.getByText(/sample photos checked/)).toBeOnTheScreen();
  for (const title of ['Similar shots', 'Exact copies', 'Possibly blurry', 'Large files']) {
    expect(screen.getByLabelText(new RegExp(`^${title}, sample\\.`))).toBeOnTheScreen();
  }
});

test('tapping a category card opens that category', async () => {
  await renderState(sampleResultsState).result;
  await fireEvent.press(screen.getByLabelText(/^Exact copies, sample\./));
  expect(router.push).toHaveBeenCalledWith('/category/exact');
});

test('partial results are marked partial and show coverage', async () => {
  await renderState({ ...sampleResultsState, analyzed: 40, total: 112 }).result;
  expect(screen.getByText('Partial')).toBeOnTheScreen();
  expect(screen.getByText('40 of 112 sample photos checked so far')).toBeOnTheScreen();
});

test('no findings shows a calm empty state instead of empty cards', async () => {
  await renderState({ ...sampleResultsState, findings: [] }).result;
  expect(screen.getByText('Nothing to clean up')).toBeOnTheScreen();
  expect(screen.queryByText('Findings')).toBeNull();
});

test('failed shows what happened and a way to try again', async () => {
  const { handlers, result } = renderState({
    status: 'failed',
    message: 'Photo access was turned off.',
  });
  await result;
  expect(screen.getByText('Scan stopped')).toBeOnTheScreen();
  expect(screen.getByText('Photo access was turned off.')).toBeOnTheScreen();
  await fireEvent.press(screen.getByLabelText('Try again'));
  expect(handlers.onShowSample).toHaveBeenCalled();
});
