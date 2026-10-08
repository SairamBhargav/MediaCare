import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { getSampleAsset, sampleFindings } from '@/demo/sample-library';
import { formatBytes } from '@/domain/bytes';
import type { GroupFinding } from '@/domain/findings';
import { toggleSelected } from '@/domain/review-selection';
import { toPhotoItem } from '@/domain/media';
import { useCatalog } from '@/state/catalog';
import { runRemoval } from '@/features/clean/run-removal';
import { useCleanSession } from '@/state/clean-session';
import { usePreferences } from '@/state/preferences';
import { selectionFor, toReviewGroup, useReviewSession } from '@/state/review-session';

import { PlanScreen } from './plan';

jest.mock('expo-router', () => ({ router: { back: jest.fn(), push: jest.fn() } }));
jest.mock('@/features/clean/run-removal', () => ({ runRemoval: jest.fn() }));
jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(() => Promise.resolve()),
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light' },
  NotificationFeedbackType: { Success: 'success', Error: 'error' },
}));

const group = sampleFindings.find(
  (finding): finding is GroupFinding => finding.kind === 'group' && finding.category === 'similar',
)!;
const [toRemove] = group.memberIds.filter((id) => id !== group.keeperId);

beforeEach(() => useCleanSession.getState().showSampleResults());

test('with nothing marked, the plan explains how to add to it', async () => {
  await render(<PlanScreen />);
  expect(screen.getByText('Nothing marked yet')).toBeOnTheScreen();
  expect(screen.getByLabelText('Remove photos')).toBeDisabled();
});

test('lists exactly what is removed and kept, warns about iCloud, and cannot remove samples', async () => {
  const review = useReviewSession.getState();
  review.setGroupSelection(
    group.id,
    toggleSelected(toReviewGroup(group, review), selectionFor(group, review), toRemove),
  );

  await render(<PlanScreen />);
  expect(screen.getByText('1 photo')).toBeOnTheScreen();
  expect(
    screen.getByText(new RegExp(`Could free up to ${formatBytes(getSampleAsset(toRemove).bytes)}`)),
  ).toBeOnTheScreen();
  expect(screen.getByText('Keeping 1 photo')).toBeOnTheScreen();
  expect(screen.getByText(getSampleAsset(group.keeperId).description)).toBeOnTheScreen();
  expect(screen.getByLabelText(getSampleAsset(toRemove).description)).toBeOnTheScreen();
  expect(screen.getByText(/also removes them from your other devices/)).toBeOnTheScreen();
  expect(screen.getByText(/Recently Deleted in the Photos app/)).toBeOnTheScreen();
  expect(screen.getByLabelText('Remove 1 photo')).toBeDisabled();
});

test('real results are labelled as your library, with no sample sizes', async () => {
  const records = ['ph://real-a', 'ph://real-b'].map((id, index) => ({
    id,
    kind: 'photo' as const,
    creationTime: 1_750_000_000_000 + index * 500,
    modificationTime: 1,
    width: 4032,
    height: 3024,
    durationMs: null,
    isFavorite: false,
    subtypes: [],
    filename: `IMG_000${index}.HEIC`,
  }));
  const items = records.map(toPhotoItem);
  useCatalog.setState({ items, byId: new Map(items.map((item) => [item.id, item])) });
  const real: GroupFinding = {
    kind: 'group',
    id: 'moments-real',
    category: 'moments',
    title: 'Real moment',
    memberIds: items.map((item) => item.id),
    keeperId: items[0].id,
    keeperReason: 'First shot',
  };
  useCleanSession.setState({
    state: { status: 'results', sample: false, analyzed: 2, total: 2, findings: [real] },
  });
  const review = useReviewSession.getState();
  review.reset();
  review.setGroupSelection(
    real.id,
    toggleSelected(toReviewGroup(real, review), selectionFor(real, review), items[1].id),
  );

  await render(<PlanScreen />);
  expect(screen.getByText('Your library')).toBeOnTheScreen();
  expect(screen.queryByText('Sample')).toBeNull();
  expect(screen.queryByText(/sample sizes/)).toBeNull();
  expect(screen.getByText(/Removing is off/)).toBeOnTheScreen();
  expect(screen.getByLabelText('Remove 1 photo')).toBeDisabled();
});

function seedRealPlan() {
  const records = ['ph://r-keep', 'ph://r-dup'].map((id, index) => ({
    id,
    kind: 'photo' as const,
    creationTime: 1_750_000_000_000 + index,
    modificationTime: 1,
    width: 10,
    height: 10,
    durationMs: null,
    isFavorite: false,
    subtypes: [],
    filename: `R${index}.HEIC`,
  }));
  const items = records.map(toPhotoItem);
  useCatalog.setState({ items, byId: new Map(items.map((item) => [item.id, item])) });
  const real: GroupFinding = {
    kind: 'group',
    id: 'similar-real',
    category: 'similar',
    title: 'Real group',
    memberIds: items.map((item) => item.id),
    keeperId: items[0].id,
    keeperReason: 'Sharpest of the group',
  };
  useCleanSession.setState({
    state: { status: 'results', sample: false, analyzed: 2, total: 2, findings: [real] },
  });
  const review = useReviewSession.getState();
  review.reset();
  review.setGroupSelection(
    real.id,
    toggleSelected(toReviewGroup(real, review), selectionFor(real, review), items[1].id),
  );
  return items;
}

test('removing stays off until it is turned on in Settings', async () => {
  await act(async () => usePreferences.getState().setAllowRemoval(false));
  seedRealPlan();
  await render(<PlanScreen />);
  expect(screen.getByLabelText('Remove 1 photo')).toBeDisabled();
  expect(screen.getByText(/Removing is off/)).toBeOnTheScreen();
});

test('with removing on: confirm, check again, iOS, then an honest report', async () => {
  usePreferences.getState().setAllowRemoval(true);
  const items = seedRealPlan();
  (runRemoval as jest.Mock).mockResolvedValue({
    kind: 'done',
    check: { removeIds: [items[1].id], skipped: [] },
    removedIds: [items[1].id],
    stillThereIds: [],
  });
  const alert = jest.spyOn(Alert, 'alert');
  await render(<PlanScreen />);
  await fireEvent.press(screen.getByLabelText('Remove 1 photo'));

  expect(alert).toHaveBeenCalled();
  expect(runRemoval).not.toHaveBeenCalled(); // nothing happens before Continue
  const buttons = alert.mock.calls[0][2]!;
  await act(async () => {
    buttons.find((button) => button.text === 'Continue')!.onPress!();
  });
  await screen.findByText('Moved 1 photo to Recently Deleted');
  expect(screen.getByText(/restore them from the Recently Deleted album/)).toBeOnTheScreen();
  await act(async () => usePreferences.getState().setAllowRemoval(false));
});

test('“Don’t Allow” in iOS is reported as nothing removed', async () => {
  usePreferences.getState().setAllowRemoval(true);
  seedRealPlan();
  (runRemoval as jest.Mock).mockResolvedValue({
    kind: 'canceled',
    check: { removeIds: ['x'], skipped: [] },
  });
  const alert = jest.spyOn(Alert, 'alert');
  await render(<PlanScreen />);
  await fireEvent.press(screen.getByLabelText('Remove 1 photo'));
  await act(async () => {
    alert.mock.calls.at(-1)![2]!.find((button) => button.text === 'Continue')!.onPress!();
  });
  await screen.findByText('Nothing was removed');
  expect(screen.getByText(/Your photos are unchanged/)).toBeOnTheScreen();
  await act(async () => usePreferences.getState().setAllowRemoval(false));
});
