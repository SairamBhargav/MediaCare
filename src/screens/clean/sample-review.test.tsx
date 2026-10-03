import { fireEvent, render, screen } from '@testing-library/react-native';

import { getSampleAsset, sampleSimilarGroup } from '@/demo/sample-library';

import { SampleReview } from './sample-review';

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(() => Promise.resolve()),
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light' },
  NotificationFeedbackType: { Success: 'success', Error: 'error' },
}));

const [keeperId, firstOtherId] = sampleSimilarGroup.memberIds;
const keeperLabel = `${getSampleAsset(keeperId).description}. Recommended keeper`;
const otherLabel = getSampleAsset(firstOtherId).description;

test('selecting a photo updates the checkbox state and the running summary', async () => {
  await render(<SampleReview />);
  expect(screen.getByText('Tap photos you might not need')).toBeTruthy();

  const tile = screen.getByLabelText(otherLabel);
  expect(tile).not.toBeChecked();

  await fireEvent.press(tile);

  expect(screen.getByLabelText(otherLabel)).toBeChecked();
  expect(screen.getByText(/^1 of 3 selected · /)).toBeTruthy();
});

test('the suggested keeper is not a checkbox and select all never includes it', async () => {
  await render(<SampleReview />);
  const keeper = screen.getByLabelText(keeperLabel);
  expect(keeper.props.accessibilityRole).not.toBe('checkbox');

  await fireEvent.press(screen.getByLabelText('Select all'));
  expect(screen.getByText(/^3 of 3 selected · /)).toBeTruthy();
  expect(screen.getAllByRole('checkbox', { checked: true })).toHaveLength(3);

  await fireEvent.press(screen.getByLabelText('Clear'));
  expect(screen.getByText('Tap photos you might not need')).toBeTruthy();
});
