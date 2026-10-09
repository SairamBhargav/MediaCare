import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { TOUR_STEPS } from '@/features/tour/steps';
import { usePreferences } from '@/state/preferences';
import { useTour } from '@/state/tour';

import { TourOverlay } from './tour-overlay';

jest.mock('expo-router', () => ({
  router: { navigate: jest.fn() },
  usePathname: () => '/',
}));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
  NotificationFeedbackType: { Success: 'success', Error: 'error' },
}));

beforeEach(() => {
  jest.useFakeTimers();
  usePreferences.getState().setTourSeen(false);
});
afterEach(() => jest.useRealTimers());

async function settle() {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(2000);
  });
}

test('nothing is drawn until the tour starts', async () => {
  useTour.setState({ active: false, index: 0 });
  await render(<TourOverlay />);
  expect(screen.queryByText(TOUR_STEPS[0].title)).toBeNull();
});

test('shows each step with Next and Back, and Skip ends it for good', async () => {
  useTour.setState({ active: true, index: 0 });
  await render(<TourOverlay />);
  await settle();
  expect(screen.getByText(TOUR_STEPS[0].title)).toBeOnTheScreen();
  expect(screen.getByText(`Step 1 of ${TOUR_STEPS.length}`)).toBeOnTheScreen();
  expect(screen.queryByLabelText('Back')).toBeNull();

  await fireEvent.press(screen.getByLabelText('Next'));
  await settle();
  // No anchor is mounted in this test, so the card shows in the middle.
  expect(screen.getByText(TOUR_STEPS[1].title)).toBeOnTheScreen();
  expect(screen.getByLabelText('Back')).toBeOnTheScreen();

  await fireEvent.press(screen.getByLabelText('Skip tour'));
  expect(useTour.getState().active).toBe(false);
  expect(usePreferences.getState().tourSeen).toBe(true);
});
