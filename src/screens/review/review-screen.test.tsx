import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { getSampleAsset, sampleFindings } from '@/demo/sample-library';
import type { GroupFinding } from '@/domain/findings';
import { useCleanSession } from '@/state/clean-session';
import { selectionFor, useReviewSession } from '@/state/review-session';

import { ReviewScreen } from '.';

jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  router: { back: jest.fn(), push: jest.fn() },
}));
jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(() => Promise.resolve()),
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light' },
  NotificationFeedbackType: { Success: 'success', Error: 'error' },
}));

const similar = sampleFindings.filter(
  (finding): finding is GroupFinding => finding.kind === 'group' && finding.category === 'similar',
);
const [first, second] = similar;
const last = similar[similar.length - 1];
const firstOther = getSampleAsset(first.memberIds.find((id) => id !== first.keeperId)!);

beforeEach(() => {
  jest.clearAllMocks();
  useCleanSession.getState().showSampleResults();
});

test('opens on the first photo that is not the keeper, explained against the keeper', async () => {
  await render(<ReviewScreen groupId={first.id} />);
  expect(screen.getByText('Not marked')).toBeOnTheScreen();
  expect(screen.getByText('Compared with the keeper:')).toBeOnTheScreen();
  expect(screen.getByText('Same dimensions')).toBeOnTheScreen();
  expect(
    screen.getByText(
      `Photo ${first.memberIds.indexOf(firstOther.id) + 1} of ${first.memberIds.length}`,
    ),
  ).toBeOnTheScreen();
});

test('marking for review records the choice in the shared review session', async () => {
  await render(<ReviewScreen groupId={first.id} />);
  await fireEvent.press(screen.getByLabelText('Mark for review'));
  expect(screen.getByText('Marked for review')).toBeOnTheScreen();
  expect(selectionFor(first, useReviewSession.getState()).selectedIds.has(firstOther.id)).toBe(
    true,
  );
  await fireEvent.press(screen.getByLabelText('Unmark'));
  expect(screen.getByText('Not marked')).toBeOnTheScreen();
});

test('keeping this photo makes it the keeper', async () => {
  await render(<ReviewScreen groupId={first.id} />);
  await fireEvent.press(screen.getByLabelText('Keep this one'));
  expect(screen.getByText('Keeper')).toBeOnTheScreen();
  expect(screen.getByText('You chose this one to keep.')).toBeOnTheScreen();
  expect(selectionFor(first, useReviewSession.getState()).keeperId).toBe(firstOther.id);
});

test('protected photos cannot be marked', async () => {
  await render(<ReviewScreen groupId={first.id} />);
  await fireEvent.press(screen.getByLabelText('Protect'));
  expect(screen.getByText('Protected')).toBeOnTheScreen();
  expect(screen.queryByLabelText('Mark for review')).toBeNull();
});

test('side by side shows the keeper next to the current photo', async () => {
  await render(<ReviewScreen groupId={first.id} />);
  await fireEvent.press(screen.getByLabelText('Side by side'));
  expect(
    screen.getByLabelText(`Keeper: ${getSampleAsset(first.keeperId).description}`),
  ).toBeOnTheScreen();
  expect(screen.getByLabelText(`This photo: ${firstOther.description}`)).toBeOnTheScreen();
});

test('next group moves through the category and the last one offers Done', async () => {
  await render(<ReviewScreen groupId={first.id} />);
  expect(screen.getByText(new RegExp(`Group 1 of ${similar.length}`))).toBeOnTheScreen();
  await fireEvent.press(screen.getByLabelText('Next group'));
  expect(screen.getByText(new RegExp(`Group 2 of ${similar.length}`))).toBeOnTheScreen();
  expect(
    screen.getByLabelText(
      `${getSampleAsset(second.memberIds[0]).description}. Photo 1 of ${second.memberIds.length}`,
    ),
  ).toBeOnTheScreen();

  await render(<ReviewScreen groupId={last.id} />);
  await fireEvent.press(screen.getByLabelText('Done'));
  expect(router.back).toHaveBeenCalled();
});

test('an unknown group explains how to get one', async () => {
  await render(<ReviewScreen groupId="nope" />);
  expect(screen.getByText('This group isn’t available')).toBeOnTheScreen();
});
