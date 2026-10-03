import { fireEvent, render, screen } from '@testing-library/react-native';

import { sampleLibrary } from '@/demo/sample-library';
import { groupByMonth } from '@/domain/timeline';
import { useLibrarySession } from '@/state/library-session';

import { LibraryScreen } from './library';

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(() => Promise.resolve()),
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light' },
  NotificationFeedbackType: { Success: 'success', Error: 'error' },
}));

beforeEach(() => useLibrarySession.getState().reset());

test('the library opens on the newest month with its count', async () => {
  const [newest] = groupByMonth(sampleLibrary);
  await render(<LibraryScreen />);
  expect(screen.getByText(newest.title)).toBeOnTheScreen();
  expect(screen.getByText(`${newest.items.length} items`)).toBeOnTheScreen();
  expect(screen.getByText(`${sampleLibrary.length} sample images`)).toBeOnTheScreen();
});

test('select mode turns photos into checkboxes and counts the selection', async () => {
  const [newest] = groupByMonth(sampleLibrary);
  const photo = newest.items[0];
  await render(<LibraryScreen />);
  expect(screen.queryAllByRole('checkbox')).toHaveLength(0);

  await fireEvent.press(screen.getByLabelText('Select'));
  await fireEvent.press(screen.getAllByLabelText(photo.description)[0]);
  expect(screen.getByText('1 selected')).toBeOnTheScreen();

  await fireEvent.press(screen.getByLabelText('Done'));
  expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
});

test('Select mode and the selection survive the screen being rebuilt', async () => {
  const [newest] = groupByMonth(sampleLibrary);
  const photo = newest.items[0];
  const first = await render(<LibraryScreen />);
  await fireEvent.press(screen.getByLabelText('Select'));
  await fireEvent.press(screen.getAllByLabelText(photo.description)[0]);
  await first.unmount();

  await render(<LibraryScreen />);
  expect(screen.getByText('1 selected')).toBeOnTheScreen();
  expect(screen.getByLabelText('Done')).toBeOnTheScreen();
  expect(screen.getAllByRole('checkbox', { checked: true })).toHaveLength(1);
});
