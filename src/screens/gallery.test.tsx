import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { usePreferences } from '@/state/preferences';

import { GalleryScreen } from './gallery';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), navigate: jest.fn() } }));

test('shows every job bar state and switches theme from the gallery', async () => {
  await render(<GalleryScreen />);
  for (const label of ['Running, total known', 'Paused', 'Finished', 'Failed', 'Stopped']) {
    expect(screen.getAllByText(label).length).toBeGreaterThan(0);
  }
  expect(screen.getByText('Original (sample)')).toBeOnTheScreen();

  await fireEvent.press(screen.getByRole('radio', { name: 'Dark' }));
  expect(usePreferences.getState().appearance).toBe('dark');
  await act(async () => usePreferences.getState().setAppearance('system'));
});
