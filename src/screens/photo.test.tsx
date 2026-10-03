import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { sampleLibrary } from '@/demo/sample-library';

import { PhotoScreen } from './photo';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn(), canGoBack: jest.fn(() => true) },
}));

const sample = sampleLibrary[0];

test('the viewer always offers a visible Close button', async () => {
  await render(<PhotoScreen id={sample.id} />);
  expect(screen.getByRole('button', { name: 'Close' })).toBeOnTheScreen();
  expect(screen.getByRole('image', { name: sample.description })).toBeOnTheScreen();
});

test('Info shows details and labels sample data', async () => {
  await render(<PhotoScreen id={sample.id} />);
  expect(screen.queryByText('Dimensions')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Info' }));
  expect(screen.getByText('Dimensions')).toBeOnTheScreen();
  expect(screen.getByText('Sample date.')).toBeOnTheScreen();
  expect(screen.getAllByText('Sample image').length).toBeGreaterThan(0);
  // Sample images can't be protected or copied.
  expect(screen.queryByRole('button', { name: 'Protect' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Smaller copy' })).toBeNull();
});

test('a missing photo explains itself and can be closed', async () => {
  await render(<PhotoScreen id="ph://gone" />);
  expect(screen.getByText('This photo isn’t available')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
  expect(router.back).toHaveBeenCalled();
});
