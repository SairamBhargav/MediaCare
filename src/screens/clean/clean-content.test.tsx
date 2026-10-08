import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { sampleFindings } from '@/demo/sample-library';
import { formatBytes } from '@/domain/bytes';
import { totalReclaimableBytes, type Finding } from '@/domain/findings';
import { reduceJob, startJob } from '@/domain/jobs';
import { knownBytes } from '@/features/media/registry';
import type { PhotoAccess } from '@/services/media/photo-library';
import { sampleResultsState, type CleanHomeState } from '@/state/clean-session';

import { CleanContent, type CleanActions } from './clean-content';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

function actions(): jest.Mocked<Required<CleanActions>> {
  return {
    onScanLibrary: jest.fn(),
    onSampleScan: jest.fn(),
    onManageSelection: jest.fn(),
    onOpenSettings: jest.fn(),
    onReset: jest.fn(),
    onOpenPlan: jest.fn(),
    onFindCopies: jest.fn(),
    onAnalyze: jest.fn(),
  };
}

async function renderState(
  state: CleanHomeState,
  access: PhotoAccess | 'unknown' = 'undetermined',
  extra: Partial<Parameters<typeof CleanContent>[0]> = {},
) {
  const handlers = actions();
  await render(<CleanContent state={state} access={access} actions={handlers} {...extra} />);
  return handlers;
}

describe('not scanned', () => {
  test('explains privacy, offers a real scan that asks for access, and the sample', async () => {
    const handlers = await renderState({ status: 'not-scanned' });
    expect(screen.getByText(/Nothing is uploaded/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByLabelText('Scan my library'));
    expect(handlers.onScanLibrary).toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText('Try with sample photos'));
    expect(handlers.onSampleScan).toHaveBeenCalled();
  });

  test('limited access scans the selection and offers to manage it', async () => {
    const handlers = await renderState({ status: 'not-scanned' }, 'limited');
    expect(screen.getByLabelText('Scan selected photos')).toBeOnTheScreen();
    await fireEvent.press(screen.getByLabelText('Manage selected photos'));
    expect(handlers.onManageSelection).toHaveBeenCalled();
  });

  test('denied access explains and opens Settings instead of nagging', async () => {
    const handlers = await renderState({ status: 'not-scanned' }, 'denied');
    expect(screen.queryByLabelText('Scan my library')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Open Settings'));
    expect(handlers.onOpenSettings).toHaveBeenCalled();
    expect(screen.getByLabelText('Try with sample photos')).toBeOnTheScreen();
  });
});

describe('sample results', () => {
  test('total counts each photo once and every category card is labelled sample', async () => {
    await renderState(sampleResultsState);
    const total = formatBytes(totalReclaimableBytes(sampleFindings, knownBytes));
    expect(screen.getByText(`Could free up to ${total}`)).toBeOnTheScreen();
    for (const title of ['Similar shots', 'Exact copies', 'Possibly blurry', 'Large files']) {
      expect(screen.getByLabelText(new RegExp(`^${title}, sample\\.`))).toBeOnTheScreen();
    }
  });

  test('tapping a category card opens that category', async () => {
    await renderState(sampleResultsState);
    await fireEvent.press(screen.getByLabelText(/^Exact copies, sample\./));
    expect(router.push).toHaveBeenCalledWith('/category/exact');
  });

  test('partial results are marked partial and show coverage', async () => {
    await renderState({ ...sampleResultsState, analyzed: 40, total: 112 });
    expect(screen.getByText('Partial')).toBeOnTheScreen();
    expect(screen.getByText('40 of 112 sample photos checked so far')).toBeOnTheScreen();
  });

  test('no findings shows a calm empty state instead of empty cards', async () => {
    await renderState({ ...sampleResultsState, findings: [] });
    expect(screen.getByText('Nothing to clean up')).toBeOnTheScreen();
    expect(screen.queryByText('Findings')).toBeNull();
  });

  test('protected photos drop out of the headline total', async () => {
    const adjustments = { protectedIds: new Set(['sample-pano-1']) };
    await renderState(sampleResultsState, 'undetermined', { adjustments });
    const total = formatBytes(totalReclaimableBytes(sampleFindings, knownBytes, adjustments));
    expect(screen.getByText(`Could free up to ${total}`)).toBeOnTheScreen();
    expect(
      screen.getByText(/protected photos and skipped groups aren’t counted/),
    ).toBeOnTheScreen();
  });
});

describe('real results', () => {
  // Real findings reference catalog items; sample ids stand in for them here.
  const findings: Finding[] = sampleFindings.filter((finding) => finding.category === 'similar');
  const real: CleanHomeState = {
    status: 'results',
    sample: false,
    analyzed: 1200,
    total: 1200,
    findings,
  };

  test('lead with a count of items to review, never a size', async () => {
    await renderState(real, 'full');
    expect(screen.getByText(/^\d+ items to review$/)).toBeOnTheScreen();
    expect(screen.queryByText(/Could free up to/)).toBeNull();
    expect(screen.getByText(/sizes aren’t measured yet/)).toBeOnTheScreen();
    expect(screen.getByText('All 1,200 photos and videos checked')).toBeOnTheScreen();
    expect(screen.queryByLabelText(/, sample\./)).toBeNull();
  });

  test('limited access says only shared photos are included', async () => {
    const handlers = await renderState(real, 'limited');
    expect(screen.getByText(/Only the photos you’ve shared/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByLabelText('Manage'));
    expect(handlers.onManageSelection).toHaveBeenCalled();
  });

  test('exact copies: never run offers the check and explains it', async () => {
    const handlers = await renderState(real, 'full', {
      copyCheck: { coverage: { checked: 0, inSets: 0, notChecked: [] }, lastStatus: null, sets: 0 },
    });
    expect(screen.getByText(/byte for byte/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByLabelText('Find exact copies'));
    expect(handlers.onFindCopies).toHaveBeenCalled();
  });

  test('exact copies: a finished check reports what was and wasn’t checked', async () => {
    await renderState(real, 'full', {
      copyCheck: {
        coverage: {
          checked: 900,
          inSets: 4,
          notChecked: [
            { reason: 'live-photo', count: 250 },
            { reason: 'in-icloud', count: 50 },
          ],
        },
        lastStatus: 'succeeded',
        sets: 2,
      },
    });
    expect(
      screen.getByText('2 sets of identical files among 900 checked photos.'),
    ).toBeOnTheScreen();
    expect(screen.getByText('Not checked: 300')).toBeOnTheScreen();
    expect(screen.getByText(/250 · Live Photos aren’t checked yet/)).toBeOnTheScreen();
    expect(screen.getByText(/50 · Stored in iCloud only/)).toBeOnTheScreen();
    expect(screen.getByLabelText('Check again')).toBeOnTheScreen();
  });

  test('exact copies: an unfinished check says so and offers to continue', async () => {
    await renderState(real, 'full', {
      copyCheck: {
        coverage: { checked: 120, inSets: 0, notChecked: [{ reason: 'not-yet', count: 800 }] },
        lastStatus: 'interrupted',
        sets: 0,
      },
    });
    expect(screen.getByText(/didn’t finish/)).toBeOnTheScreen();
    expect(screen.getByText(/800 · Not checked yet/)).toBeOnTheScreen();
    expect(screen.getByLabelText('Continue checking')).toBeOnTheScreen();
  });

  test('photo check in Expo Go explains it needs the app and offers no button', async () => {
    await renderState(real, 'full', {
      analysis: { available: false, coverage: { analyzed: 0, notAnalyzed: [] }, lastStatus: null },
    });
    expect(screen.getByText(/needs the MediaCare app/)).toBeOnTheScreen();
    expect(screen.queryByLabelText('Look at my photos')).toBeNull();
  });

  test('photo check: never run offers it; a finished run reports coverage', async () => {
    const handlers = await renderState(real, 'full', {
      analysis: { available: true, coverage: { analyzed: 0, notAnalyzed: [] }, lastStatus: null },
    });
    await fireEvent.press(screen.getByLabelText('Look at my photos'));
    expect(handlers.onAnalyze).toHaveBeenCalled();
  });

  test('photo check: finished run lists what was not looked at and why', async () => {
    await renderState(real, 'full', {
      analysis: {
        available: true,
        coverage: { analyzed: 950, notAnalyzed: [{ reason: 'in-icloud', count: 40 }] },
        lastStatus: 'succeeded',
      },
    });
    expect(screen.getByText(/950 photos looked at/)).toBeOnTheScreen();
    expect(screen.getByText('Not looked at: 40')).toBeOnTheScreen();
    expect(screen.getByText(/40 · Stored in iCloud only/)).toBeOnTheScreen();
  });

  test('sample results never offer the exact copies check', async () => {
    await renderState(sampleResultsState, 'full', {
      copyCheck: { coverage: { checked: 0, inSets: 0, notChecked: [] }, lastStatus: null, sets: 0 },
    });
    expect(screen.queryByLabelText('Find exact copies')).toBeNull();
  });

  test('a changed library prompts a new scan', async () => {
    const handlers = await renderState(real, 'full', { libraryChanged: true });
    expect(screen.getByText('Photos changed')).toBeOnTheScreen();
    await fireEvent.press(screen.getAllByLabelText('Scan again')[0]);
    expect(handlers.onScanLibrary).toHaveBeenCalled();
  });
});

test('failed shows what happened and a way to try again', async () => {
  const handlers = await renderState({ status: 'failed', message: 'Photo access was turned off.' });
  expect(screen.getByText('Scan stopped')).toBeOnTheScreen();
  await fireEvent.press(screen.getByLabelText('Try again'));
  expect(handlers.onScanLibrary).toHaveBeenCalled();
});

test('an active scan replaces the content with honest progress and controls', async () => {
  const job = [
    { type: 'total-known', total: 112 } as const,
    { type: 'progress', stage: 'checking', processed: 48 } as const,
  ].reduce(reduceJob, startJob('j', true));
  const scanActions = { onPause: jest.fn(), onResume: jest.fn(), onStop: jest.fn() };
  await renderState(sampleResultsState, 'full', { job, scanActions });
  expect(screen.getByText('Scanning…')).toBeOnTheScreen();
  expect(screen.getByText('Checking photos · 48 of 112')).toBeOnTheScreen();
  await fireEvent.press(screen.getByLabelText('Pause'));
  expect(scanActions.onPause).toHaveBeenCalled();
  await fireEvent.press(screen.getByLabelText('Stop scan'));
  expect(scanActions.onStop).toHaveBeenCalled();
});
