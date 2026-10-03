import { fireEvent, render, screen } from '@testing-library/react-native';

import { getSampleAsset, sampleFindings } from '@/demo/sample-library';
import { formatBytes } from '@/domain/bytes';
import type { GroupFinding } from '@/domain/findings';
import { useCleanSession } from '@/state/clean-session';

import { CategoryScreen } from '.';

jest.mock('expo-router', () => ({ Stack: { Screen: () => null }, router: { push: jest.fn() } }));
jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(() => Promise.resolve()),
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light' },
  NotificationFeedbackType: { Success: 'success', Error: 'error' },
}));

const similarGroups = sampleFindings.filter(
  (finding): finding is GroupFinding => finding.kind === 'group' && finding.category === 'similar',
);

function nonKeeper(group: GroupFinding) {
  return getSampleAsset(group.memberIds.find((id) => id !== group.keeperId)!);
}

beforeEach(() => useCleanSession.getState().showSampleResults());

test('selections across groups add up in one summary', async () => {
  await render(<CategoryScreen category="similar" />);
  expect(screen.getByText('Tap photos you might not need')).toBeOnTheScreen();

  const first = nonKeeper(similarGroups[0]);
  const second = nonKeeper(similarGroups[1]);
  await fireEvent.press(screen.getByLabelText(first.description));
  await fireEvent.press(screen.getByLabelText(second.description));

  expect(screen.getByLabelText(first.description)).toBeChecked();
  expect(
    screen.getByText(`2 selected · ${formatBytes(first.bytes + second.bytes)} (sample sizes)`),
  ).toBeOnTheScreen();
});

test('keepers are never offered as checkboxes', async () => {
  await render(<CategoryScreen category="similar" />);
  const checkboxes = screen.getAllByRole('checkbox');
  const members = similarGroups.reduce((sum, group) => sum + group.memberIds.length, 0);
  expect(checkboxes).toHaveLength(members - similarGroups.length);
});

test('flagged photos show why they were flagged', async () => {
  await render(<CategoryScreen category="blurry" />);
  expect(screen.getAllByText('Very little sharp detail anywhere').length).toBeGreaterThan(0);
});

test('without results the category explains how to get some', async () => {
  useCleanSession.getState().reset();
  await render(<CategoryScreen category="large" />);
  expect(screen.getByText('Nothing here yet')).toBeOnTheScreen();
});

test('selections survive leaving the category and coming back', async () => {
  const photo = nonKeeper(similarGroups[0]);
  const first = await render(<CategoryScreen category="similar" />);
  await fireEvent.press(screen.getByLabelText(photo.description));
  await first.unmount();

  await render(<CategoryScreen category="similar" />);
  expect(screen.getByLabelText(photo.description)).toBeChecked();
});

test('skipping a group collapses it, clears its selection and can be undone', async () => {
  const group = similarGroups[0];
  const photo = nonKeeper(group);
  await render(<CategoryScreen category="similar" />);
  await fireEvent.press(screen.getByLabelText(photo.description));
  await fireEvent.press(screen.getAllByLabelText('Skip')[0]);

  expect(
    screen.getByText('Skipped. These photos won’t be counted or suggested.'),
  ).toBeOnTheScreen();
  expect(screen.queryByLabelText(photo.description)).toBeNull();
  expect(screen.getByText('Tap photos you might not need')).toBeOnTheScreen();

  await fireEvent.press(screen.getByLabelText('Undo'));
  expect(screen.getByLabelText(photo.description)).not.toBeChecked();
});

test('protecting a photo through its VoiceOver action removes the checkbox', async () => {
  const photo = nonKeeper(similarGroups[0]);
  await render(<CategoryScreen category="similar" />);
  const tile = screen.getByLabelText(photo.description);
  await fireEvent(tile, 'accessibilityAction', { nativeEvent: { actionName: 'Protect' } });

  const protectedTile = screen.getByLabelText(`${photo.description}. Protected`);
  expect(protectedTile.props.accessibilityRole).not.toBe('checkbox');
});

test('choosing a different keeper moves the keep badge', async () => {
  const group = similarGroups[0];
  const photo = nonKeeper(group);
  await render(<CategoryScreen category="similar" />);
  await fireEvent(screen.getByLabelText(photo.description), 'accessibilityAction', {
    nativeEvent: { actionName: 'Keep this one instead' },
  });
  expect(screen.getByLabelText(`${photo.description}. Keeper`)).toBeOnTheScreen();
  expect(screen.getByText('You chose the keeper for this group.')).toBeOnTheScreen();
});

test('Compare escapes group ids, which contain ph:// identifiers for real photos', async () => {
  const { router } = jest.requireMock('expo-router') as { router: { push: jest.Mock } };
  await render(<CategoryScreen category="similar" />);
  await fireEvent.press(screen.getAllByLabelText('Compare')[0]);
  const target = router.push.mock.calls.at(-1)?.[0] as string;
  expect(target).toBe(`/review/${encodeURIComponent(similarGroups[0].id)}`);
  // A real id like "moments-ph://UUID/L0/001" must stay a single path segment.
  expect(`/review/${encodeURIComponent('moments-ph://A1B2/L0/001')}`.split('/')).toHaveLength(3);
});
