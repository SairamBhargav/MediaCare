import { fireEvent, render, screen } from '@testing-library/react-native';

import { getSampleAsset, sampleFindings } from '@/demo/sample-library';
import { formatBytes } from '@/domain/bytes';
import type { GroupFinding } from '@/domain/findings';
import { useCleanSession } from '@/state/clean-session';

import { CategoryScreen } from '.';

jest.mock('expo-router', () => ({ Stack: { Screen: () => null } }));
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
